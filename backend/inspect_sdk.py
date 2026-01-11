from vertexai.preview.vision_models import ImageGenerationModel
import inspect

print("Methods of ImageGenerationModel:")
print(dir(ImageGenerationModel))

print("\nHelp for edit_image:")
print(help(ImageGenerationModel.edit_image))

print("\nHelp for generate_images:")
print(help(ImageGenerationModel.generate_images))
