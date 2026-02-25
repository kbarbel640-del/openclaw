#!/usr/bin/env python3
"""
Face Detection Sidecar — InsightFace SCRFD

Detects faces in photographs and assesses per-face quality:
  - Face bounding boxes
  - Face sharpness score
  - Eye openness estimation
  - Face orientation (pitch, yaw, roll)

Usage:
  python3 detect_faces.py --image /path/to/photo.jpg

Output: JSON to stdout
"""

import argparse
import json
import sys
from pathlib import Path


def detect_faces(image_path: str) -> dict:
    """
    Detect faces using InsightFace's SCRFD model.
    Returns bounding boxes, landmarks, and per-face quality metrics.
    """
    try:
        import cv2
        import numpy as np
        from insightface.app import FaceAnalysis

        # Initialize InsightFace
        app = FaceAnalysis(
            name="buffalo_sc",
            providers=["CoreMLExecutionProvider", "CPUExecutionProvider"],
        )
        app.prepare(ctx_id=0, det_size=(640, 640))

        # Read image
        img = cv2.imread(image_path)
        if img is None:
            return {"error": f"Could not read image: {image_path}", "faces": []}

        # Detect faces
        faces = app.get(img)

        results = []
        for i, face in enumerate(faces):
            bbox = face.bbox.tolist()
            score = float(face.det_score)

            # Compute face region for quality analysis
            x1, y1, x2, y2 = [int(b) for b in bbox]
            face_region = img[max(0, y1):min(img.shape[0], y2),
                              max(0, x1):min(img.shape[1], x2)]

            # Sharpness: Laplacian variance of the face region
            if face_region.size > 0:
                gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)
                sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            else:
                sharpness = 0.0

            # Landmarks for eye openness estimation
            landmarks = None
            eye_openness = None
            if face.landmark_2d_106 is not None:
                landmarks = face.landmark_2d_106.tolist()
                # Estimate eye openness from landmark distances
                # Left eye: landmarks 33-42, Right eye: landmarks 87-96
                try:
                    left_eye_top = np.array(landmarks[37])
                    left_eye_bottom = np.array(landmarks[41])
                    left_eye_dist = np.linalg.norm(left_eye_top - left_eye_bottom)

                    right_eye_top = np.array(landmarks[93])
                    right_eye_bottom = np.array(landmarks[97]) if len(landmarks) > 97 else np.array(landmarks[87])
                    right_eye_dist = np.linalg.norm(right_eye_top - right_eye_bottom)

                    # Normalize by face width
                    face_width = x2 - x1
                    if face_width > 0:
                        eye_openness = float((left_eye_dist + right_eye_dist) / (2 * face_width))
                except (IndexError, ValueError):
                    eye_openness = None

            # Orientation from pose (if available)
            orientation = None
            if hasattr(face, "pose") and face.pose is not None:
                orientation = {
                    "pitch": float(face.pose[0]),
                    "yaw": float(face.pose[1]),
                    "roll": float(face.pose[2]),
                }

            results.append({
                "face_id": i,
                "bbox": bbox,
                "detection_score": round(score, 4),
                "sharpness": round(sharpness, 2),
                "eye_openness": round(eye_openness, 4) if eye_openness is not None else None,
                "orientation": orientation,
            })

        return {
            "image": image_path,
            "face_count": len(results),
            "faces": results,
            "image_width": img.shape[1],
            "image_height": img.shape[0],
        }

    except ImportError:
        return {
            "error": "insightface or opencv not installed. Install via: pip install insightface opencv-python",
            "faces": [],
        }
    except Exception as e:
        return {"error": str(e), "faces": []}


def main():
    parser = argparse.ArgumentParser(description="Face Detection Sidecar")
    parser.add_argument("--image", required=True, help="Path to the image file")
    args = parser.parse_args()

    image_path = args.image
    if not Path(image_path).exists():
        print(json.dumps({"error": f"Image not found: {image_path}", "faces": []}))
        sys.exit(1)

    result = detect_faces(image_path)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
