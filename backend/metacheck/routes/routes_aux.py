import os

import cv2
import numpy as np
from aiofiles import os as aiofiles_os
from aiopath import AsyncPath

# Author: Michael Polívka xpoliv07
# Summary: Auxiliary functions for route operations, such as image preview generation.

async def make_preview_from_image(
    image: np.ndarray, preview_path: str, resolution: int
):
    """
    Create and save a preview thumbnail from an image.
    
    Args:
        image: NumPy array containing the image data
        preview_path: Path where the preview should be saved
        resolution: Target resolution for the preview
    """
    scale = (resolution / float(image.shape[0] * image.shape[1])) ** 0.5
    image = cv2.resize(image, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    preview_dir = AsyncPath(os.path.split(preview_path)[0])
    if not await preview_dir.exists():
        await aiofiles_os.makedirs(
            preview_dir, exist_ok=True
        )  # exist_ok=True is needed due to multiprocessing
    cv2.imwrite(f"{preview_path}", image)
