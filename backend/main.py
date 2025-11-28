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
        content = await file.read()
        
        # Open image using PIL to get dimensions and create mask
        from PIL import Image as PILImage
        
        pil_image = PILImage.open(io.BytesIO(content))
        
        # Convert to RGB if needed (e.g. if RGBA)
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
            
        # Create a buffer for the processed input image
        # Use tempfile to avoid BytesIO issues with Vertex AI SDK
        import tempfile
        
        # Save input image to temp file
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f_in:
            pil_image.save(f_in, format="PNG")
            input_path = f_in.name
            
        input_image = Image.load_from_file(input_path)

        # Create a full white mask (edit everything)
        mask_pil = PILImage.new("L", pil_image.size, 255)
        
        # Save mask to temp file
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f_mask:
            mask_pil.save(f_mask, format="PNG")
            mask_path = f_mask.name
            
        mask_image = Image.load_from_file(mask_path)

        # Load the model
        # Using 'imagegeneration@006' or similar latest model
        # Fallback to a more stable model version if 006 is not available
        try:
            model = ImageGenerationModel.from_pretrained("imagegeneration@006")
        except:
            logger.warning("Model imagegeneration@006 not found, trying imagegeneration@005")
            model = ImageGenerationModel.from_pretrained("imagegeneration@005")

        # Construct the prompt
        # Template: "A high-quality, cute, 3D rendered character based on this sketch. Pixar style, vibrant colors, soft lighting, 4k resolution."
        base_prompt = "A high-quality, cute, 3D rendered character based on this sketch. Pixar style, vibrant colors, soft lighting, 4k resolution."
        full_prompt = f"{base_prompt} Style: {style_prompt}"
        
        logger.info(f"Generating image with prompt: {full_prompt}")

        # Generate Image
        # We use edit_image to transform the sketch. 
        # We provide a full mask to allow editing the entire image.
        logger.info(f"Input Image Type: {type(input_image)}")
        logger.info(f"Mask Image Type: {type(mask_image)}")
        
        try:
            images = model.edit_image(
                base_image=input_image,
                mask=mask_image,
                prompt=full_prompt,
                guidance_scale=21, # Strong adherence to prompt
            )
        finally:
            # Cleanup temp files
            if os.path.exists(input_path):
                os.remove(input_path)
            if os.path.exists(mask_path):
                os.remove(mask_path)

        if not images:
            raise HTTPException(status_code=500, detail="No image generated")

        # ... (previous code) ...
        generated_image = images[0]

        # Save to buffer
        output_buffer = io.BytesIO()
        generated_image.save(output_buffer, include_generation_parameters=False)
        image_bytes = output_buffer.getvalue()

        # Upload to Cloud Storage
        from google.cloud import storage
        import uuid

        bucket_name = f"{PROJECT_ID}-generated-images"
        destination_blob_name = f"generated/{uuid.uuid4()}.png"

        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)
        
        blob.upload_from_string(image_bytes, content_type="image/png")
        
        # Since we made the bucket public, we can use the public link
        # Alternatively, blob.public_url (requires legacy ACLs usually) or construct it manually
        public_url = f"https://storage.googleapis.com/{bucket_name}/{destination_blob_name}"
        
        logger.info(f"Image saved to {public_url}")

        return {"image": public_url}

    except Exception as e:
        logger.error(f"Error generating image: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
