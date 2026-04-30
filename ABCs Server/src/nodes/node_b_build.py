"""
Node B: Build. Source extraction and JSON generation.
"""
import os
import re
import json
import logging
import requests
import yt_dlp
import webvtt
from bs4 import BeautifulSoup
from ddgs import DDGS
from typing import Any, Dict
from config import B_FOLDER, A_FOLDER

logger = logging.getLogger(__name__)

def extract_youtube_info(url: str, out_dir: str) -> Dict[str, Any]:
    """Extract metadata and subtitles using yt-dlp."""
    ydl_opts = {
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitleslangs': ['en'],
        'outtmpl': os.path.join(out_dir, 'source_video.%(ext)s'),
        'quiet': True
    }
    
    transcript = ""
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True) # Downloads subtitle only
            
            vtt_file = None
            for file in os.listdir(out_dir):
                if file.endswith('.vtt'):
                    vtt_file = os.path.join(out_dir, file)
                    break
            
            if vtt_file:
                try:
                    for caption in webvtt.read(vtt_file):
                        text = re.sub(r'<[^>]*>', '', caption.text).strip()
                        if text:
                            transcript += text + " "
                except Exception as ve:
                    logger.error(f"Failed to parse vtt: {ve}")
                    with open(vtt_file, 'r', encoding='utf-8') as f:
                        transcript = f.read()

            return {
                "title": info.get('title'),
                "description": info.get('description'),
                "channel": info.get('uploader'),
                "url": url,
                "content": transcript.strip(),
                "type": "video"
            }
    except Exception as e:
        logger.error(f"Error extracting youtube info: {e}")
        return {"url": url, "type": "video", "error": str(e), "content": ""}

def search_and_scrape_web(query: str) -> Dict[str, Any]:
    """Search DuckDuckGo and scrape the first result."""
    try:
        ddgs = DDGS()
        results = list(ddgs.text(query, max_results=1))
        if not results:
            return {"title": query, "content": query, "type": "text"}
            
        first_result = results[0]
        url = first_result.get('href')
        title = first_result.get('title')
        
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        for element in soup(["script", "style", "nav", "footer", "header"]):
            element.decompose()
            
        text = soup.get_text(separator=' ', strip=True)
        
        return {
            "title": title,
            "url": url,
            "content": text,
            "type": "article"
        }
    except Exception as e:
        logger.error(f"Web scraping failed: {e}")
        return {"title": query, "content": query, "type": "text"}

def extract_source(state: Dict[str, Any]) -> Dict[str, Any]:
    """Node B Extract implementation: Extracts source info and generates structured data."""
    logger.info("Executing Node B: Extract")
    messages = state.get("messages", [])
    
    latest_message = messages[-1]["content"] if messages else ""
    topic = state.get("topic", "").strip()
    
    url = None
    # We look at the 'topic' field because parse_command extracts the rest of the string into topic
    # For C: B "http..." topic is "http..."
    if "http://" in topic or "https://" in topic:
        for word in topic.split():
            if "http://" in word or "https://" in word:
                url = word
                break
                
    task_id = state.get("task_id", "default_task")
    transcripts_dir = os.path.join(A_FOLDER, "Files", "Transcripts")
    os.makedirs(transcripts_dir, exist_ok=True)
    
    temp_dir = os.path.join("/tmp", "abcs_extract", task_id)
    os.makedirs(temp_dir, exist_ok=True)
            
    extracted_data = {}
    if url:
        if "youtube.com" in url or "youtu.be" in url:
            extracted_data = extract_youtube_info(url, temp_dir)
        else:
            extracted_data = {"url": url, "type": "article", "title": "Web Article", "content": ""}
    elif topic:
        # It's a text search
        extracted_data = search_and_scrape_web(topic)
    else:
        extracted_data = {"content": latest_message, "type": "text"}
        
    # Save the raw transcript to A/Files/Transcripts
    transcript_text = extracted_data.get("content", "")
    safe_title = "".join([c for c in extracted_data.get("title", "Unknown") if c.isalnum() or c==' ']).strip().replace(' ', '_')
    transcript_file = os.path.join(transcripts_dir, f"{task_id}_{safe_title}.md")
    
    with open(transcript_file, "w", encoding="utf-8") as f:
        f.write(f"---\ntitle: \"{extracted_data.get('title', 'Unknown')}\"\nurl: \"{extracted_data.get('url', '')}\"\n---\n\n")
        f.write(transcript_text)
        
    extracted_data["transcript_path"] = transcript_file
        
    # Append the extracted data to context
    context = state.get("context", {})
    context["source_data"] = extracted_data
    
    # Save JSON to A/Files/JSONs/
    json_dir = os.path.join(A_FOLDER, "Files", "JSONs")
    os.makedirs(json_dir, exist_ok=True)
        
    file_path = os.path.join(json_dir, f"{task_id}_source.json")
    
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(extracted_data, f, indent=2)
        
    logger.info(f"Saved extracted source data to {file_path}")
    return {"context": context}

def synthesize_b_note(state: Dict[str, Any]) -> Dict[str, Any]:
    """Node B Synthesize implementation: Creates the final markdown note in B/Searches/."""
    logger.info("Executing Node B: Synthesize")
    
    context = state.get("context", {})
    source_data = context.get("source_data", {})
    atomic_notes = context.get("atomic_notes", [])
    topic = state.get("topic", "")
    if not topic:
        topic = "General_Search"
    topic_clean = "".join([c for c in topic if c.isalnum() or c==' ']).strip().replace(' ', '_')
    task_id = state.get("task_id", "default_task")
    
    search_dir = os.path.join(B_FOLDER, "Searches")
    os.makedirs(search_dir, exist_ok=True)
    
    file_path = os.path.join(search_dir, f"{topic_clean}_{task_id}.md")
    
    content = f"# Search: {topic}\n\n"
    content += "## Source\n"
    if "url" in source_data:
        content += f"- URL: {source_data['url']}\n"
        content += f"- Title: {source_data.get('title', 'Unknown')}\n"
    else:
        content += f"- Search Query: {topic}\n"
        content += f"- Scraped Title: {source_data.get('title', 'Unknown')}\n"
        if "url" in source_data:
            content += f"- Scraped URL: {source_data['url']}\n"
            
    if "transcript_path" in source_data:
        # compute rel path
        rel_path = source_data["transcript_path"]
        if "abcs-workspace/" in rel_path:
            rel_path = rel_path.split("abcs-workspace/")[1]
        content += f"- Full Transcript: [[{rel_path}]]\n"
        
    content += "\n## Extracted Atomics\n"
    for note in atomic_notes:
        note_path = note.get('path', '')
        if "abcs-workspace/" in note_path:
            rel_path = note_path.split("abcs-workspace/")[1]
            content += f"- [[{rel_path}]]\n"
        else:
            content += f"- [[{note_path}]]\n"
        
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    logger.info(f"Synthesized final B note at {file_path}")
    return state
