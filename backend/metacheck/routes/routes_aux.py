import os

import cv2
import numpy as np
from aiofiles import os as aiofiles_os
from aiopath import AsyncPath


async def make_preview_from_image(
    image: np.ndarray, preview_path: str, resolution: int
):
    scale = (resolution / float(image.shape[0] * image.shape[1])) ** 0.5
    image = cv2.resize(image, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    preview_dir = AsyncPath(os.path.split(preview_path)[0])
    if not await preview_dir.exists():
        await aiofiles_os.makedirs(
            preview_dir, exist_ok=True
        )  # exist_ok=True is needed due to multiprocessing
    cv2.imwrite(f"{preview_path}", image)
