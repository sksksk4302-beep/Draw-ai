import os
import io
import base64
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel, Image

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Magic Sketchbook API")

# CORS Configuration
origins = ["*"]  # For development; restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Vertex AI
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

if PROJECT_ID:
    try:
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        logger.info(f"Vertex AI initialized: {PROJECT_ID} @ {LOCATION}")
    except Exception as e:
        logger.error(f"Failed to initialize Vertex AI: {e}")
else:
    logger.warning("GOOGLE_CLOUD_PROJECT env var not set. Vertex AI calls will fail.")

@app.get("/")
async def health_check():
    return {"status": "ok", "service": "Magic Sketchbook Backend"}

@app.post("/generate-image")
async def generate_image(
    file: UploadFile = File(...),
    style_prompt: str = Form("3D render")
):
    try:
        if not PROJECT_ID:
            raise HTTPException(status_code=500, detail="Server misconfigured: Missing Google Cloud Project ID")

        # Read the image file
        image_bytes = await file.read()
        
        logger.info("Starting two-stage generation: Gemini Vision + Imagen")
        
        # ---------------------------------------------------------
        # STAGE 1: Gemini Vision - Analyze the sketch
        # ---------------------------------------------------------
        from vertexai.generative_models import GenerativeModel, Part
        
        # Use Gemini 2.5 Flash for image recognition
        gemini_model = GenerativeModel("gemini-2.5-flash")
        
        # Create image part from bytes
        image_part = Part.from_data(image_bytes, mime_type="image/png")
        
        # Prompt to extract the meaning of the sketch
        vision_prompt = """
        Describe this sketch simply and positively for a child's drawing app.
        Focus on shapes and objects. 
        If it's abstract or messy, describe it as 'a creative abstract colorful shape'.
        Do NOT use words related to violence, weapons, or adult content.
        """
        
        logger.info("Analyzing sketch with Gemini Vision...")
        vision_response = gemini_model.generate_content([image_part, vision_prompt])
        detected_object = vision_response.text.strip()
        logger.info(f"👀 Gemini detected: {detected_object}")

        # ---------------------------------------------------------
        # STAGE 2: Imagen - Generate high-quality image
        # ---------------------------------------------------------
        imagen_model = ImageGenerationModel.from_pretrained("imagegeneration@006")
        
        # Construct the final prompt
        final_prompt = f"""
        A cute, 3D rendered digital art of {detected_object}.
        Pixar style, soft lighting, vibrant friendly colors, 4k resolution.
        Suitable for children. Style: {style_prompt}
        """
        
        logger.info(f"Generating image with Imagen. Prompt: {final_prompt}")
        
        # Generate new image from text (not editing the original)
        response = imagen_model.generate_images(
            prompt=final_prompt,
            number_of_images=1,
            aspect_ratio="4:3",
            safety_filter_level="block_some",
            person_generation="allow_adult"
        )

        # Check if images were generated using response.images
        if not response.images or len(response.images) == 0:
            logger.error("🚫 Imagen did not generate any images. Possible safety filter block.")
            raise HTTPException(status_code=400, detail="AI가 이 그림은 그리기 어렵대요. (안전 문제로 차단됨)")

        generated_image = response.images[0]
        logger.info(f"✅ Successfully generated image")

        # Save to temporary file
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f_out:
            output_path = f_out.name
            
        try:
            generated_image.save(output_path, include_generation_parameters=False)
            with open(output_path, "rb") as f:
                image_bytes = f.read()
        finally:
            if os.path.exists(output_path):
                os.remove(output_path)

        # Upload to Cloud Storage
        from google.cloud import storage
        import uuid

        bucket_name = f"{PROJECT_ID}-generated-images"
        destination_blob_name = f"generated/{uuid.uuid4()}.png"

        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)
        
        blob.upload_from_string(image_bytes, content_type="image/png")
        
        public_url = f"https://storage.googleapis.com/{bucket_name}/{destination_blob_name}"
        
        logger.info(f"Image saved to {public_url}")
        logger.info(f"Description used: {detected_object}")

        return {"image": public_url, "description": detected_object}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
