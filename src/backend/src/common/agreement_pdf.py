"""
Build agreement PDF from workflow steps and step results.

Used when an approval workflow includes a generate_pdf step. Builds PDF from
pdf_contribution (legal_text, acceptances_list, fields) and step_results;
writes to the given output path (e.g. volume path from MetadataManager.ensure_volume_path).
"""

from pathlib import Path
from typing import Any, Dict, List, Optional

from src.common.logging import get_logger

logger = get_logger(__name__)


def build_agreement_pdf(
    workflow_name: str,
    entity_type: str,
    entity_id: str,
    steps_with_config: List[Dict[str, Any]],
    step_results: List[Dict[str, Any]],
    output_path: str,
) -> str:
    """
    Build a PDF from workflow step configs and step results, write to output_path.

    steps_with_config: list of { step_id, name, step_type, config } (config may have pdf_contribution).
    step_results: list of { step_id, payload } from the wizard.

    pdf_contribution per step can include: legal_text, acceptances_list, fields (field_ids to include).
    Writes title, legal text blocks, acceptances, and field values; returns the path written.
    """
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
        from reportlab.lib.units import inch
    except ImportError:
        logger.warning("reportlab not installed; cannot generate agreement PDF")
        raise RuntimeError("reportlab is required for PDF generation")

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    c = canvas.Canvas(str(path), pagesize=letter)
    width, height = letter
    y = height - inch

    def draw_string_line(text: str, x: float = inch, font_size: int = 12) -> bool:
        nonlocal y
        c.setFont("Helvetica", font_size)
        if y < inch:
            c.showPage()
            y = height - inch
        c.drawString(x, y, text[:90] + "..." if len(text) > 90 else text)
        y -= font_size * 1.2
        return True

    # Title
    c.setFont("Helvetica-Bold", 16)
    c.drawString(inch, y, f"Agreement: {workflow_name}")
    y -= 24
    c.setFont("Helvetica", 10)
    c.drawString(inch, y, f"Entity: {entity_type} / {entity_id}")
    y -= 20

    # Collect content from steps that have pdf_contribution
    for step in steps_with_config:
        config = step.get("config") or {}
        pdf_contrib = config.get("pdf_contribution") or {}
        step_id = step.get("step_id", "")
        result = next((r for r in step_results if r.get("step_id") == step_id), None)
        payload = (result or {}).get("payload") or {}

        if pdf_contrib.get("legal_text"):
            draw_string_line("Legal / Terms:", font_size=11)
            c.setFont("Helvetica", 9)
            for line in (pdf_contrib["legal_text"] or "").split("\n")[:20]:
                if y < inch:
                    c.showPage()
                    y = height - inch
                c.drawString(inch, y, line[:100])
                y -= 12
            y -= 6

        if pdf_contrib.get("acceptances_list") and payload:
            draw_string_line("Acceptances:", font_size=11)
            for acc in pdf_contrib.get("acceptances_list", [])[:15]:
                label = acc.get("label", acc.get("id", ""))
                value = payload.get(acc.get("id", ""), "—")
                draw_string_line(f"  • {label}: {value}", font_size=9)
            y -= 6

        if pdf_contrib.get("fields"):
            for fid in pdf_contrib.get("fields", [])[:20]:
                value = payload.get(fid, "—")
                draw_string_line(f"  {fid}: {value}", font_size=9)
            y -= 6

    # If no pdf_contribution, at least list step results
    if y >= height - 2 * inch:
        draw_string_line("Summary of responses:", font_size=11)
        for r in step_results:
            step_id = r.get("step_id", "")
            payload = r.get("payload") or {}
            for k, v in (payload or {}).items():
                if isinstance(v, str) and len(v) < 80:
                    draw_string_line(f"  {k}: {v}", font_size=9)
                elif isinstance(v, str):
                    draw_string_line(f"  {k}: {v[:80]}...", font_size=9)

    c.save()
    logger.info(f"Agreement PDF written to {path}")
    return str(path)
