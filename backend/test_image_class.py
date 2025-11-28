from vertexai.preview.vision_models import Image
import io

try:
    # Test with bytes
    b = b"fakeimagebytes"
    img = Image(b)
    print("Successfully created Image from bytes")
except Exception as e:
    print(f"Failed to create Image from bytes: {e}")

try:
    # Test with BytesIO (which is what the error mentions)
    bio = io.BytesIO(b"fakeimagebytes")
    img = Image(bio)
    print("Successfully created Image from BytesIO")
except Exception as e:
    print(f"Failed to create Image from BytesIO: {e}")
