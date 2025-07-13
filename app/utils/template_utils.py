"""
Utilities for template rendering to bridge the gap between Flask and FastAPI template systems
"""
from fastapi import Request
from typing import Any, Dict

def url_for(name: str, **kwargs) -> str:
    """
    Mimics Flask's url_for function for static files to make templates compatible
    
    Args:
        name: The name of the endpoint, usually 'static'
        **kwargs: Keyword arguments which can include either 'filename' (Flask style) 
                  or 'path' (FastAPI/Starlette style)
        
    Returns:
        The full URL path to the static file
    """
    if name == 'static':
        # Support both Flask (filename) and FastAPI/Starlette (path) style parameters
        file_path = kwargs.get('filename', kwargs.get('path', ''))
        # Remove leading slash if present
        if file_path.startswith('/'):
            file_path = file_path[1:]
        return f"/static/{file_path}"
    raise ValueError(f"Unsupported endpoint name: {name}")

def process_template_context(request: Request) -> Dict[str, Any]:
    """
    Process template context to make Flask-style templates work with FastAPI
    
    Args:
        request: The FastAPI request object
        
    Returns:
        Context dictionary with all required helpers for the template
    """
    context = {"request": request}
    
    # Add url_for function to the context to mimic Flask's behavior
    context["url_for"] = url_for
    
    return context
