import base64
import json
from typing import Any

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.config import settings

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.0,
    google_api_key=settings.GEMINI_API_KEY,
    convert_system_message_to_human=True
)

ANALYSIS_PROMPT = """
Analyze this photo for a reminiscence therapy app.
Return a strictly valid JSON object with the following keys:
- people (list of strings describing age/gender)
- setting (string)
- mood (string)
- objects (list of strings)
- exact_date_estimate (string or null)
"""


async def analyze_image(image_bytes: bytes) -> dict[str, Any]:
    """Analyze an image using Gemini and return structured metadata."""
    b64_image = base64.b64encode(image_bytes).decode('utf-8')
    image_url = f"data:image/jpeg;base64,{b64_image}"

    message = HumanMessage(
        content=[
            {"type": "text", "text": ANALYSIS_PROMPT},
            {"type": "image_url", "image_url": image_url}
        ]
    )

    response = await llm.ainvoke([message])

    try:
        content_text = response.content.replace('```json', '').replace('```', '')
        return json.loads(content_text)
    except (json.JSONDecodeError, AttributeError):
        return {"raw_analysis": response.content}


async def curate_session(media_pool: list[dict[str, Any]], target_count: int) -> list[str]:
    """
    Use AI to select exactly target_count photos from the pool to create a therapeutic narrative.
    Returns a list of media IDs in the selected order.
    """
    if not media_pool:
        return []

    # Prepare a condensed version of the pool for the LLM
    condensed_pool = []
    for item in media_pool:
        tags = [f"{t['tag_type']}:{t['tag_value']}" for t in item.get('tags', [])]
        condensed_pool.append({
            "id": item["id"],
            "caption": item.get("caption") or "No caption",
            "date": str(item.get("date_taken")) if item.get("date_taken") else "Unknown",
            "tags": tags
        })

    prompt = f"""
    You are a specialized Reminiscence Therapist. 
    Your goal is to curate exactly {target_count} photos from the pool below to create a meaningful, positive, and cohesive 
    slideshow session for a patient with memory loss.

    POOL OF PHOTOS:
    {json.dumps(condensed_pool, indent=2)}

    CRITERIA:
    1. Select EXACTLY {target_count} photo IDs (or fewer if the pool is smaller than {target_count}).
    2. Create a "narrative arc": start with familiar faces/home, move to events/nature, and end on a high-energy or very positive note.
    3. Ensure variety. Don't pick 5 photos of the same person in a row.
    4. Return ONLY a JSON list of photo IDs in the selected order.

    Example Output: ["uuid-1", "uuid-2", "uuid-3"]
    """

    try:
        response = await llm.ainvoke(prompt)
        content_text = response.content.replace('```json', '').replace('```', '').strip()
        selected_ids = json.loads(content_text)
        
        if isinstance(selected_ids, list):
            # Ensure we only return IDs that actually exist in the pool
            valid_ids = {item["id"] for item in media_pool}
            return [str(mid) for mid in selected_ids if str(mid) in valid_ids][:target_count]
            
        return []
    except Exception as e:
        # Fallback will be handled at the router level
        return []