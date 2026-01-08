import os
import io
import uuid
import logging
import traceback
import json
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# Google Cloud Imports
import vertexai
from vertexai.generative_models import GenerativeModel, Part
from vertexai.preview.vision_models import ImageGenerationModel
from google.cloud import storage
from google.cloud.dialogflowcx_v3beta1.services.sessions import SessionsClient
from google.cloud.dialogflowcx_v3beta1.types import session
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Magic Sketchbook API")

# CORS Configuration
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Environment Variables
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
AGENT_ID = os.getenv("AGENT_ID")

# Initialize Vertex AI
if PROJECT_ID:
    try:
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        logger.info(f"Vertex AI initialized: {PROJECT_ID} @ {LOCATION}")
    except Exception as e:
        logger.error(f"Failed to initialize Vertex AI: {e}")
else:
    logger.warning("GOOGLE_CLOUD_PROJECT env var not set. AI calls will fail.")

# Initialize Firebase
try:
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore.client()
    logger.info("Firebase initialized.")
    db = firestore.client()
    logger.info("Firebase initialized.")
except Exception as e:
    logger.error(f"Failed to initialize Firebase: {e}")
    db = None

# ---------------------------------------------------------
# Models
# ---------------------------------------------------------
from pydantic import BaseModel

class LoginRequest(BaseModel):
    uid: str
    email: Optional[str] = None
    display_name: Optional[str] = None

class LoginResponse(BaseModel):
    uid: str
    potions: int
    role: str
    is_new_user: bool

@app.get("/")
async def health_check():
    return {"status": "ok", "service": "Magic Sketchbook Backend (Dialogflow CX)"}

# ---------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------

async def analyze_image(image_bytes: bytes) -> str:
    """
    Stage 1 (Eye): Use Gemini 2.5 Flash to describe the sketch.
    """
    logger.info("Stage 1: Analyzing sketch with Gemini Vision...")
    model = GenerativeModel("gemini-2.5-flash")
    image_part = Part.from_data(image_bytes, mime_type="image/png")
    
    prompt = """
    Describe this sketch simply and positively.
    Focus on shapes and objects.
    If it's abstract, describe it as 'a creative abstract shape'.
    Do NOT use words related to violence or adult content.
    """
    
    response = model.generate_content([image_part, prompt])
    description = response.text.strip()
    logger.info(f"👀 Gemini detected: {description}")
    return description

async def consult_agent(session_id: str, user_text: str, image_description: str) -> dict:
    """
    Stage 2 (Brain): Send context to Vertex AI Agent (Dialogflow CX).
    Returns a dict with 'text' (agent reply) and optional 'draw_prompt' (if agent decides to draw).
    """
    logger.info(f"Stage 2: Consulting Agent (ID: {AGENT_ID})...")
    
    if not AGENT_ID:
        logger.warning("AGENT_ID not set. Skipping agent.")
        return {"text": "Agent ID가 설정되지 않았습니다.", "draw_prompt": None}

    # Configure Dialogflow CX Client
    if LOCATION != "global":
        api_endpoint = f"{LOCATION}-dialogflow.googleapis.com"
        client_options = {"api_endpoint": api_endpoint}
    else:
        client_options = None

    client = SessionsClient(client_options=client_options)
    session_path = client.session_path(
        project=PROJECT_ID,
        location=LOCATION,
        agent=AGENT_ID,
        session=session_id
    )

    # Construct input
    # We inject a system instruction to guide the agent's behavior (Persona Injection)
    system_instruction = """
    [System Instruction]
    당신은 아이들의 창의력을 길러주는 친절한 미술 선생님 '한울'입니다.
    
    [대화 규칙]
    1. 사용자의 말에 바로 "그려볼까요?"라고 끝내지 마세요.
    2. **한 번에 하나의 질문만 하세요.** 절대 여러 질문을 동시에 쏟아내지 마세요.
    3. 사용자의 답변을 듣고, 그에 이어서 구체적인 질문을 하나씩 던지며 이미지를 구체화하세요. (예: "색깔은 무엇인가요?" -> 답변 듣고 -> "그럼 표정은 어떻게 할까요?")
    4. 아이의 상상력을 자극하는 칭찬을 많이 해주세요.
    5. 말투는 다정하고 친절한 '해요체'를 사용하세요.
    6. 사용자가 "그려줘"라고 하거나 충분히 구체화되었다고 판단될 때까지 대화를 이어가세요.
    """

    full_input = f"{system_instruction}\n\n[사용자 말]: {user_text}"
    
    if image_description and image_description != "이미지 없음":
        full_input = f"{system_instruction}\n\n[사용자가 그린 그림 설명]: {image_description}\n[사용자 말]: {user_text}"

    text_input = session.TextInput(text=full_input)
    query_input = session.QueryInput(text=text_input, language_code="ko")

    request = session.DetectIntentRequest(
        session=session_path,
        query_input=query_input
    )

    response = client.detect_intent(request=request)
    
    # Extract Agent Reply
    agent_reply = ""
    for message in response.query_result.response_messages:
        if message.text:
            agent_reply += message.text.text[0] + " "
    
    agent_reply = agent_reply.strip()
    logger.info(f"🧠 Agent Reply: {agent_reply}")

    # Parse Agent Reply for Drawing Intent
    # We assume the agent is instructed to output "DRAW_PROMPT: ..." if it wants to draw.
    draw_prompt = None
    display_text = agent_reply

    if "DRAW_PROMPT:" in agent_reply:
        parts = agent_reply.split("DRAW_PROMPT:")
        display_text = parts[0].strip()
        draw_prompt = parts[1].strip()
        logger.info(f"🎨 Agent decided to draw: {draw_prompt}")

    return {"text": display_text, "draw_prompt": draw_prompt}

async def generate_image_from_text(prompt: str) -> str:
    """
    Stage 3 (Hand): Generate image using Imagen.
    Returns public URL of the generated image.
    """
    logger.info(f"Stage 3: Generating image with prompt: {prompt}")
    model = ImageGenerationModel.from_pretrained("imagegeneration@006")
    
    final_prompt = f"""
    {prompt}
    Pixar style, soft lighting, vibrant friendly colors, 4k resolution, 3D render.
    Suitable for children.
    """
    
    response = model.generate_images(
        prompt=final_prompt,
        number_of_images=1,
        aspect_ratio="4:3",
        safety_filter_level="block_some",
        person_generation="allow_adult"
    )

    if not response.images:
        raise HTTPException(status_code=400, detail="이미지를 생성할 수 없습니다 (안전 필터).")

    # Save and Upload
    generated_image = response.images[0]
    
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f_out:
        generated_image.save(f_out.name, include_generation_parameters=False)
        output_path = f_out.name

    try:
        bucket_name = f"{PROJECT_ID}-generated-images"
        destination_blob_name = f"generated/{uuid.uuid4()}.png"
        
        storage_client = storage.Client()
        try:
            bucket = storage_client.get_bucket(bucket_name)
        except:
            bucket = storage_client.create_bucket(bucket_name, location=LOCATION)

        blob = bucket.blob(destination_blob_name)
        blob.upload_from_filename(output_path, content_type="image/png")
        
        # Make public
        public_url = f"https://storage.googleapis.com/{bucket_name}/{destination_blob_name}"
        return public_url
    finally:
        if os.path.exists(output_path):
            os.remove(output_path)

async def generate_prompt_from_history(history: list, user_text: str) -> str:
    """
    Stage 2.5 (Fallback): Use Gemini to generate a drawing prompt if the Agent didn't provide one.
    """
    logger.info("Stage 2.5: Generating draw prompt from history with Gemini...")
    model = GenerativeModel("gemini-2.5-flash")
    
    history_text = ""
    for msg in history:
        role = "User" if msg.get("role") == "user" else "Assistant"
        history_text += f"{role}: {msg.get('text')}\n"
    
    prompt = f"""
    You are a creative assistant. The user wants to draw something based on the conversation.
    Create a detailed image generation prompt in English based on the context below.
    
    Conversation History:
    {history_text}
    
    Current Request:
    {user_text}
    
    If the context is empty or unclear, generate a prompt for a "magical creative art studio".
    Output ONLY the English prompt, no other text.
    """
    
    response = model.generate_content(prompt)
    response = model.generate_content(prompt)
    return response.text.strip()

async def generate_image_cheap(prompt: str) -> str:
    """
    Stage 3-B (Cheap): Generate image using a cheaper model (e.g., Stable Diffusion).
    For now, this is a placeholder or can use a lower quality setting.
    """
    logger.info(f"Generating cheap image for: {prompt}")
    # TODO: Implement actual Stable Diffusion API call here
    # For demonstration, we'll use a placeholder or the same model if needed, 
    # but strictly speaking this should be a different cheaper API.
    # Returning a placeholder for now to indicate the flow.
    return "https://placehold.co/600x400/png?text=Cheap+Image+Mode"

def save_to_gallery(uid: str, image_url: str, prompt: str, style_type: str = "premium"):
    if not db:
        logger.warning("DB not initialized, skipping save.")
        return
    
    try:
        doc_ref = db.collection("gallery").document()
        doc_ref.set({
            "uid": uid,
            "image_url": image_url,
            "prompt": prompt,
            "style_type": style_type,
            "created_at": datetime.utcnow()
        })
        logger.info(f"Saved to gallery: {doc_ref.id}")
        logger.info(f"Saved to gallery: {doc_ref.id}")
    except Exception as e:
        logger.error(f"Failed to save to gallery: {e}")

def get_user_potions(uid: str) -> int:
    if not db: return 0
    try:
        doc = db.collection("users").document(uid).get()
        if doc.exists:
            return doc.to_dict().get("potions", 0)
        return 0
    except:
        return 0

def deduct_potion(uid: str, amount: int = 1) -> bool:
    if not db: return False
    try:
        user_ref = db.collection("users").document(uid)
        
        @firestore.transactional
        def update_in_transaction(transaction, ref):
            snapshot = transaction.get(ref)
            if not snapshot.exists:
                return False
            current_potions = snapshot.get("potions")
            if current_potions < amount:
                return False
            transaction.update(ref, {"potions": current_potions - amount})
            return True

        transaction = db.transaction()
        return update_in_transaction(transaction, user_ref)
    except Exception as e:
        logger.error(f"Potion deduction failed: {e}")
        return False

# ---------------------------------------------------------
# Endpoints
# ---------------------------------------------------------

@app.post("/chat-to-draw")
async def chat_to_draw(
    file: Optional[UploadFile] = File(None),
    user_text: str = Form(...),
    session_id: str = Form("default-session"),
    generate_image: bool = Form(True),
    chat_history: str = Form("[]"),
    uid: str = Form("anonymous"),
    style_type: str = Form("premium") # premium or cheap
):
    try:
        # 1. Analyze Image (if provided)
        image_desc = "이미지 없음"
        if file:
            image_bytes = await file.read()
            if len(image_bytes) > 0:
                image_desc = await analyze_image(image_bytes)
        
        # 2. Consult Agent (Dialogflow CX)
        agent_result = await consult_agent(session_id, user_text, image_desc)
        
        draw_prompt = agent_result["draw_prompt"]
        
        # 2.5 Fallback: If generate_image is requested but Agent didn't give a prompt
        if generate_image and not draw_prompt:
            try:
                history_list = json.loads(chat_history)
            except:
                history_list = []
            
            logger.info("⚠️ Agent didn't return a prompt. Using Gemini fallback.")
            draw_prompt = await generate_prompt_from_history(history_list, user_text)
            logger.info(f"🎨 Gemini generated prompt: {draw_prompt}")

        response_data = {
            "agent_message": agent_result["text"],
            "generated_image": None,
            "draw_prompt": draw_prompt
        }

        # 3. Generate Image (if we have a prompt AND generate_image is True)
        if draw_prompt and generate_image:
            # Check Potions for Premium Mode (if User)
            if style_type == "premium" and uid != "anonymous":
                if not deduct_potion(uid, 1):
                    raise HTTPException(status_code=402, detail="NOT_ENOUGH_POTIONS")

            if style_type == "cheap":
                image_url = await generate_image_cheap(draw_prompt)
            else:
                image_url = await generate_image_from_text(draw_prompt)
            
            response_data["generated_image"] = image_url
            
            # Save to Gallery
            save_to_gallery(uid, image_url, draw_prompt, style_type)
            
        return response_data

    except Exception as e:
        logger.error(f"❌ Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-image")
async def generate_image_legacy(
    file: UploadFile = File(...),
    style_prompt: str = Form("3D render")
):
    image_bytes = await file.read()
    desc = await analyze_image(image_bytes)
    prompt = f"A cute, 3D rendered digital art of {desc}. Style: {style_prompt}"
    url = await generate_image_from_text(prompt)
    return {"image": url, "description": desc}
    return {"image": url, "description": desc}

@app.get("/api/gallery")
async def get_gallery(uid: str):
    if not db:
        raise HTTPException(status_code=500, detail="Database not available")
    try:
        # Note: Requires an index on 'uid' and 'created_at' DESC in Firestore
        docs = db.collection("gallery").where("uid", "==", uid).order_by("created_at", direction=firestore.Query.DESCENDING).stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]
    except Exception as e:
        logger.error(f"Error fetching gallery: {e}")
        # Fallback if index is missing or other error
        docs = db.collection("gallery").where("uid", "==", uid).stream()
        items = [{"id": doc.id, **doc.to_dict()} for doc in docs]
        # Sort in memory if query fails
        items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return items
        items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return items

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    if not db:
        raise HTTPException(status_code=500, detail="Database error")
    
    try:
        user_ref = db.collection("users").document(request.uid)
        doc = user_ref.get()
        
        if doc.exists:
            user_data = doc.to_dict()
            return LoginResponse(
                uid=request.uid,
                potions=user_data.get("potions", 0),
                role=user_data.get("role", "user"),
                is_new_user=False
            )
        else:
            # New User - Give 2 Potions
            new_user = {
                "uid": request.uid,
                "email": request.email,
                "display_name": request.display_name,
                "potions": 2,
                "role": "user",
                "created_at": datetime.utcnow()
            }
            user_ref.set(new_user)
            return LoginResponse(
                uid=request.uid,
                potions=2,
                role="user",
                is_new_user=True
            )
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
