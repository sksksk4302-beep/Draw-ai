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
    # We include the image description in the text if it's relevant
    full_input = user_text
    if image_description and image_description != "이미지 없음":
        full_input = f"[사용자가 그린 그림: {image_description}]\n{user_text}"

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

# ---------------------------------------------------------
# Endpoints
# ---------------------------------------------------------

@app.post("/chat-to-draw")
async def chat_to_draw(
    file: Optional[UploadFile] = File(None),
    user_text: str = Form(...),
    session_id: str = Form("default-session"),
    generate_image: bool = Form(True),
    chat_history: str = Form("[]") # We ignore this for Dialogflow CX as it manages state
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
        
        response_data = {
            "agent_message": agent_result["text"],
            "generated_image": None,
            "draw_prompt": agent_result["draw_prompt"]
        }

        # 3. Generate Image (if Agent requested AND generate_image is True)
        if agent_result["draw_prompt"] and generate_image:
            image_url = await generate_image_from_text(agent_result["draw_prompt"])
            response_data["generated_image"] = image_url
            
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
