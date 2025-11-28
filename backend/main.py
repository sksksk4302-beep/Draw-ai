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
        
        # Create Vertex AI Image object
        input_image = Image(content)

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
        # Note: Depending on the specific model version, parameters might vary.
        # We assume 'edit_image' is the correct method for image-to-image/inpainting tasks 
        # or we use generate_images with specific guidance if supported.
        # For this MVP, we will try to use edit_image without a mask (full image edit) if supported,
        # or assume the model can handle it.
        
        # If edit_image requires a mask, we might need to create a full-white mask or similar.
        # However, newer models support 'image guidance' in generate_images.
        # Let's try the generate_images with 'image' parameter if possible, but standard SDK is usually edit_image.
        
        # Attempting to use edit_image which is standard for modification
        images = model.edit_image(
            base_image=input_image,
            prompt=full_prompt,
            guidance_scale=21, # Strong adherence to prompt
            # mask=... # Optional in some versions for full image edit?
        )

        if not images:
            raise HTTPException(status_code=500, detail="No image generated")

        generated_image = images[0]

        # Convert to Base64
        output_buffer = io.BytesIO()
        generated_image.save(output_buffer, include_generation_parameters=False)
        encoded_string = base64.b64encode(output_buffer.getvalue()).decode("utf-8")

        return {"image": f"data:image/png;base64,{encoded_string}"}

    except Exception as e:
        logger.error(f"Error generating image: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
