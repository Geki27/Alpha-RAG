#!/usr/bin/env python3
"""
AetherVector RAG - Python PDF Extraction, Per-Page Triage & Page Rasterizer
1. Attempts extraction via installed Python libraries (PyMuPDF/fitz -> pdfplumber -> pypdf).
2. Falls back to built-in pure-Python PDF parser (ObjStm + FlateDecode + ToUnicode CMap)
   enhanced with Ghostscript (gs txtwrite) when available.
3. Classifies each page individually:
   - If the page has real readable text content -> isScanned = False (NO OCR needed)
   - If the page lacks real text or has corrupted font encoding -> isScanned = True (OCR fallback)
4. Supports rendering specific scanned pages to PNG for Vision OCR (Gemini / NVIDIA NIM).
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import zlib
from typing import Any, Dict, List, Optional, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


MIN_REAL_ALNUM_CHARS = 25
MIN_REAL_WORDS = 4
MAX_CORRUPTED_RATIO = 0.15


def classify_page_text(
    text: str,
    image_count: int = 0,
    has_text_operators: bool = False,
    engine: str = "python",
) -> Dict[str, Any]:
    cleaned = (text or "").replace("\r\n", "\n").strip()
    non_ws = re.sub(r"\s+", "", cleaned)
    char_count = len(non_ws)

    # Count Unicode letters and digits (works for Spanish, English, technical symbols)
    alnum_chars = [ch for ch in non_ws if ch.isalnum()]
    alnum_count = len(alnum_chars)

    # Count corrupted / replacement / control / PUA characters
    corrupted_count = 0
    for ch in non_ws:
        code = ord(ch)
        if ch == "\ufffd" or (code < 32) or (0xE000 <= code <= 0xF8FF):
            corrupted_count += 1

    corrupted_ratio = (corrupted_count / char_count) if char_count > 0 else 0.0
    readable_ratio = (alnum_count / char_count) if char_count > 0 else 0.0

    # Words with >= 2 alphanumeric chars
    words = re.findall(r"[^\W_]{2,}", cleaned, flags=re.UNICODE)
    word_count = len(words)

    is_corrupted = char_count > 0 and corrupted_ratio > MAX_CORRUPTED_RATIO

    # Has real extracted content?
    has_real_content = (
        not is_corrupted
        and alnum_count >= MIN_REAL_ALNUM_CHARS
        and word_count >= MIN_REAL_WORDS
        and readable_ratio >= 0.30
    )

    # Short valid title/cover/equation page without full-page scan image
    if (
        not has_real_content
        and not is_corrupted
        and image_count == 0
        and alnum_count >= 12
        and word_count >= 2
        and readable_ratio >= 0.45
    ):
        has_real_content = True

    is_scanned = not has_real_content

    # If using pure-python stdlib (no fitz/pdfplumber/pypdf) and page has BT/TJ operators
    # but we got little/corrupted text (e.g., CIDFont/Type0 custom font encoding),
    # flag needsNodeTextCheck so Node (pdfjs/unpdf) can verify native text before declaring scanned.
    needs_node_text_check = (
        is_scanned
        and engine == "python-stdlib"
        and has_text_operators
    )

    return {
        "charCount": char_count,
        "alnumCount": alnum_count,
        "wordCount": word_count,
        "corruptedRatio": round(corrupted_ratio, 4),
        "readableRatio": round(readable_ratio, 4),
        "isScanned": is_scanned,
        "needsNodeTextCheck": needs_node_text_check,
    }


def find_ghostscript() -> Optional[str]:
    for candidate in ("gs", "gswin64c", "gswin32c"):
        found = shutil.which(candidate)
        if found:
            return found
    return None


def find_pdftoppm() -> Optional[str]:
    return shutil.which("pdftoppm")


def render_page_via_external(
    pdf_path: str, page_number: int, out_png_path: str, dpi: int = 180
) -> bool:
    gs_bin = find_ghostscript()
    if gs_bin:
        try:
            cmd = [
                gs_bin,
                "-q",
                "-dNOPAUSE",
                "-dBATCH",
                "-dSAFER",
                "-sDEVICE=png16m",
                f"-r{dpi}",
                f"-dFirstPage={page_number}",
                f"-dLastPage={page_number}",
                f"-sOutputFile={out_png_path}",
                pdf_path,
            ]
            res = subprocess.run(cmd, capture_output=True, timeout=30)
            if res.returncode == 0 and os.path.exists(out_png_path) and os.path.getsize(out_png_path) > 0:
                return True
        except Exception:
            pass

    pdftoppm_bin = find_pdftoppm()
    if pdftoppm_bin:
        try:
            prefix = out_png_path[:-4] if out_png_path.lower().endswith(".png") else out_png_path
            cmd = [
                pdftoppm_bin,
                "-png",
                "-r",
                str(dpi),
                "-f",
                str(page_number),
                "-l",
                str(page_number),
                "-singlefile",
                pdf_path,
                prefix,
            ]
            res = subprocess.run(cmd, capture_output=True, timeout=30)
            if res.returncode == 0 and os.path.exists(out_png_path) and os.path.getsize(out_png_path) > 0:
                return True
        except Exception:
            pass

    return False


def extract_page_via_gs_txtwrite(gs_bin: str, pdf_path: str, page_number: int) -> str:
    try:
        cmd = [
            gs_bin,
            "-q",
            "-dNOPAUSE",
            "-dBATCH",
            "-dSAFER",
            "-sDEVICE=txtwrite",
            f"-dFirstPage={page_number}",
            f"-dLastPage={page_number}",
            "-sOutputFile=%stdout",
            pdf_path,
        ]
        res = subprocess.run(cmd, capture_output=True, timeout=20)
        if res.returncode == 0:
            raw = res.stdout.decode("utf-8", errors="replace")
            # Filter out Ghostscript diagnostic lines if any leaked to stdout
            lines = [
                ln
                for ln in raw.splitlines()
                if not ln.lstrip().startswith("**** ")
                and "Output may be incorrect." not in ln
            ]
            return "\n".join(lines).strip()
    except Exception:
        pass
    return ""


# ==============================================================================
# LIBRARY 1: PyMuPDF (fitz)
# ==============================================================================
def try_extract_with_fitz(
    pdf_path: str, render_dir: Optional[str], dpi: int
) -> Optional[Dict[str, Any]]:
    try:
        import fitz  # type: ignore
    except ImportError:
        return None

    doc = fitz.open(pdf_path)
    try:
        meta = doc.metadata or {}
        pages_out: List[Dict[str, Any]] = []
        total_pages = len(doc)

        for idx in range(total_pages):
            page = doc[idx]
            page_num = idx + 1
            # Extract blocks sorted roughly top-to-bottom, left-to-right for technical accuracy
            text = page.get_text("text") or ""
            image_count = len(page.get_images(full=True))
            stats = classify_page_text(
                text, image_count=image_count, has_text_operators=bool(text.strip()), engine="python-fitz"
            )

            rendered_path = None
            if stats["isScanned"] and render_dir:
                os.makedirs(render_dir, exist_ok=True)
                out_png = os.path.join(render_dir, f"page_{page_num}.png")
                pix = page.get_pixmap(dpi=dpi)
                pix.save(out_png)
                if os.path.exists(out_png) and os.path.getsize(out_png) > 0:
                    rendered_path = out_png

            pages_out.append(
                {
                    "pageNumber": page_num,
                    "text": text.strip(),
                    "imageCount": image_count,
                    "hasTextOperators": bool(text.strip()),
                    "renderedImagePath": rendered_path,
                    **stats,
                }
            )

        return {
            "success": True,
            "engine": "python-fitz",
            "totalPages": max(1, total_pages),
            "metadata": {
                "title": (meta.get("title") or "").strip(),
                "author": (meta.get("author") or "").strip(),
            },
            "pages": pages_out,
        }
    finally:
        doc.close()


# ==============================================================================
# LIBRARY 2: pdfplumber
# ==============================================================================
def try_extract_with_pdfplumber(
    pdf_path: str, render_dir: Optional[str], dpi: int
) -> Optional[Dict[str, Any]]:
    try:
        import pdfplumber  # type: ignore
    except ImportError:
        return None

    with pdfplumber.open(pdf_path) as pdf:
        meta = pdf.metadata or {}
        pages_out: List[Dict[str, Any]] = []
        total_pages = len(pdf.pages)

        for idx, page in enumerate(pdf.pages):
            page_num = idx + 1
            text = (page.extract_text() or "").strip()
            image_count = len(page.images or [])

            # Append Markdown-formatted tables if present
            try:
                tables = page.extract_tables() or []
                for tbl in tables:
                    clean_rows = [
                        [str(cell or "").replace("\n", " ").strip() for cell in row]
                        for row in tbl
                        if row and any(str(c or "").strip() for c in row)
                    ]
                    if len(clean_rows) >= 2:
                        header = clean_rows[0]
                        md_lines = [
                            "| " + " | ".join(header) + " |",
                            "| " + " | ".join(["---"] * len(header)) + " |",
                        ]
                        for r in clean_rows[1:]:
                            padded = r + [""] * max(0, len(header) - len(r))
                            md_lines.append("| " + " | ".join(padded[: len(header)]) + " |")
                        table_md = "\n".join(md_lines)
                        if table_md not in text:
                            text = f"{text}\n\n{table_md}".strip()
            except Exception:
                pass

            stats = classify_page_text(
                text, image_count=image_count, has_text_operators=bool(text), engine="python-pdfplumber"
            )
            rendered_path = None
            if stats["isScanned"] and render_dir:
                os.makedirs(render_dir, exist_ok=True)
                out_png = os.path.join(render_dir, f"page_{page_num}.png")
                if render_page_via_external(pdf_path, page_num, out_png, dpi):
                    rendered_path = out_png

            pages_out.append(
                {
                    "pageNumber": page_num,
                    "text": text,
                    "imageCount": image_count,
                    "hasTextOperators": bool(text),
                    "renderedImagePath": rendered_path,
                    **stats,
                }
            )

        return {
            "success": True,
            "engine": "python-pdfplumber",
            "totalPages": max(1, total_pages),
            "metadata": {
                "title": str(meta.get("Title") or "").strip(),
                "author": str(meta.get("Author") or "").strip(),
            },
            "pages": pages_out,
        }


# ==============================================================================
# LIBRARY 3: pypdf / PyPDF2
# ==============================================================================
def try_extract_with_pypdf(
    pdf_path: str, render_dir: Optional[str], dpi: int
) -> Optional[Dict[str, Any]]:
    PdfReader = None
    engine_name = "python-pypdf"
    try:
        from pypdf import PdfReader as _Reader  # type: ignore
        PdfReader = _Reader
    except ImportError:
        try:
            from PyPDF2 import PdfReader as _Reader2  # type: ignore
            PdfReader = _Reader2
            engine_name = "python-pypdf2"
        except ImportError:
            return None

    reader = PdfReader(pdf_path)
    meta = getattr(reader, "metadata", None) or {}
    pages_out: List[Dict[str, Any]] = []
    total_pages = len(reader.pages)

    for idx, page in enumerate(reader.pages):
        page_num = idx + 1
        text = (page.extract_text() or "").strip()
        image_count = 0
        try:
            image_count = len(getattr(page, "images", []) or [])
        except Exception:
            pass

        stats = classify_page_text(
            text, image_count=image_count, has_text_operators=bool(text), engine=engine_name
        )
        rendered_path = None
        if stats["isScanned"] and render_dir:
            os.makedirs(render_dir, exist_ok=True)
            out_png = os.path.join(render_dir, f"page_{page_num}.png")
            if render_page_via_external(pdf_path, page_num, out_png, dpi):
                rendered_path = out_png

        pages_out.append(
            {
                "pageNumber": page_num,
                "text": text,
                "imageCount": image_count,
                "hasTextOperators": bool(text),
                "renderedImagePath": rendered_path,
                **stats,
            }
        )

    return {
        "success": True,
        "engine": engine_name,
        "totalPages": max(1, total_pages),
        "metadata": {
            "title": str(meta.get("/Title") or "").strip() if hasattr(meta, "get") else "",
            "author": str(meta.get("/Author") or "").strip() if hasattr(meta, "get") else "",
        },
        "pages": pages_out,
    }


# ==============================================================================
# LIBRARY 4: Pure-Python Built-in PDF Parser (zero pip dependencies) + gs fallback
# ==============================================================================
_OBJ_RE = re.compile(rb"(\d+)\s+(\d+)\s+obj\b(.*?)\bendobj\b", re.DOTALL)
_REF_RE = re.compile(rb"(\d+)\s+(\d+)\s+R\b")


def _extract_dict_and_stream(body: bytes) -> Tuple[bytes, Optional[bytes]]:
    stream_idx = body.find(b"stream")
    if stream_idx == -1:
        return body, None
    dict_part = body[:stream_idx]
    after = body[stream_idx + 6 :]
    if after.startswith(b"\r\n"):
        after = after[2:]
    elif after.startswith(b"\n") or after.startswith(b"\r"):
        after = after[1:]
    endstream_idx = after.rfind(b"endstream")
    if endstream_idx != -1:
        raw_stream = after[:endstream_idx]
        if raw_stream.endswith(b"\r\n"):
            raw_stream = raw_stream[:-2]
        elif raw_stream.endswith(b"\n") or raw_stream.endswith(b"\r"):
            raw_stream = raw_stream[:-1]
    else:
        raw_stream = after
    return dict_part, raw_stream


def _decompress_stream(dict_part: bytes, raw_stream: Optional[bytes]) -> bytes:
    if raw_stream is None:
        return b""
    if b"/FlateDecode" in dict_part or b"/Fl" in dict_part:
        for wbits in (15, -15, 47):
            try:
                return zlib.decompress(raw_stream, wbits)
            except Exception:
                continue
    return raw_stream


def _parse_pdf_objects(pdf_bytes: bytes) -> Tuple[Dict[int, Tuple[bytes, Optional[bytes]]], Optional[int]]:
    objects: Dict[int, Tuple[bytes, Optional[bytes]]] = {}
    for m in _OBJ_RE.finditer(pdf_bytes):
        obj_num = int(m.group(1))
        body = m.group(3)
        dict_part, raw_stream = _extract_dict_and_stream(body)
        objects[obj_num] = (dict_part, raw_stream)

        # Unpack PDF 1.5+ /ObjStm compressed object streams
        if b"/ObjStm" in dict_part and raw_stream is not None:
            decompressed = _decompress_stream(dict_part, raw_stream)
            first_m = re.search(rb"/First\s+(\d+)", dict_part)
            n_m = re.search(rb"/N\s+(\d+)", dict_part)
            if first_m and n_m:
                first = int(first_m.group(1))
                header = decompressed[:first].decode("latin1", errors="ignore").split()
                pairs = [
                    (int(header[i]), int(header[i + 1]))
                    for i in range(0, min(len(header) - 1, int(n_m.group(1)) * 2), 2)
                ]
                for idx_p, (inner_id, off) in enumerate(pairs):
                    start = first + off
                    end = (
                        first + pairs[idx_p + 1][1]
                        if idx_p + 1 < len(pairs)
                        else len(decompressed)
                    )
                    inner_body = decompressed[start:end]
                    objects[inner_id] = (inner_body, None)

    root_id: Optional[int] = None
    for m in re.finditer(rb"/Root\s+(\d+)\s+\d+\s+R", pdf_bytes):
        root_id = int(m.group(1))
    return objects, root_id


def _collect_page_ids(
    objects: Dict[int, Tuple[bytes, Optional[bytes]]], root_id: Optional[int]
) -> List[int]:
    if root_id and root_id in objects:
        root_dict = objects[root_id][0]
        pages_m = re.search(rb"/Pages\s+(\d+)\s+\d+\s+R", root_dict)
        if pages_m:
            pages_root = int(pages_m.group(1))
            ordered: List[int] = []
            visited = set()

            def walk(node_id: int) -> None:
                if node_id in visited or node_id not in objects:
                    return
                visited.add(node_id)
                d = objects[node_id][0]
                if re.search(rb"/Type\s*/Pages\b", d) or b"/Kids" in d:
                    kids_m = re.search(rb"/Kids\s*\[(.*?)\]", d, re.DOTALL)
                    if kids_m:
                        for rm in _REF_RE.finditer(kids_m.group(1)):
                            walk(int(rm.group(1)))
                        return
                ordered.append(node_id)

            walk(pages_root)
            if ordered:
                return ordered

    # Fallback: scan all /Type /Page objects in order
    fallback_pages = []
    for oid, (d, _) in objects.items():
        if re.search(rb"/Type\s*/Page\b(?!s)", d):
            fallback_pages.append(oid)
    return sorted(fallback_pages)


def _decode_pdf_literal(raw: bytes) -> str:
    out = bytearray()
    i = 0
    n = len(raw)
    while i < n:
        b = raw[i]
        if b == 0x5C and i + 1 < n:  # backslash
            nxt = raw[i + 1]
            if nxt == ord("n"):
                out.append(10)
                i += 2
            elif nxt == ord("r"):
                out.append(13)
                i += 2
            elif nxt == ord("t"):
                out.append(9)
                i += 2
            elif nxt == ord("b"):
                out.append(8)
                i += 2
            elif nxt == ord("f"):
                out.append(12)
                i += 2
            elif nxt in (ord("("), ord(")"), ord("\\")):
                out.append(nxt)
                i += 2
            elif 48 <= nxt <= 55:
                oct_digits = bytes([nxt])
                j = i + 2
                while j < min(n, i + 4) and 48 <= raw[j] <= 55:
                    oct_digits += bytes([raw[j]])
                    j += 1
                out.append(int(oct_digits, 8) & 0xFF)
                i = j
            elif nxt in (10, 13):
                i += 2
                if nxt == 13 and i < n and raw[i] == 10:
                    i += 1
            else:
                out.append(nxt)
                i += 2
        else:
            out.append(b)
            i += 1
    try:
        return out.decode("cp1252")
    except Exception:
        return out.decode("latin1", errors="replace")


def _parse_tounicode_cmap(cmap_bytes: bytes) -> Dict[int, str]:
    mapping: Dict[int, str] = {}
    text = cmap_bytes.decode("latin1", errors="ignore")

    for block in re.finditer(r"beginbfchar(.*?)endbfchar", text, re.DOTALL):
        for line in block.group(1).splitlines():
            m = re.match(r"\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*", line)
            if m:
                src = int(m.group(1), 16)
                dst_bytes = bytes.fromhex(m.group(2))
                try:
                    mapping[src] = dst_bytes.decode("utf-16-be")
                except Exception:
                    mapping[src] = dst_bytes.decode("latin1", errors="ignore")

    for block in re.finditer(r"beginbfrange(.*?)endbfrange", text, re.DOTALL):
        for line in block.group(1).splitlines():
            m = re.match(
                r"\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*", line
            )
            if m:
                start = int(m.group(1), 16)
                end = int(m.group(2), 16)
                dst_start = int(m.group(3), 16)
                for offset, code in enumerate(range(start, min(end + 1, start + 512))):
                    mapping[code] = chr(dst_start + offset)
    return mapping


def _decode_hex_string(hex_raw: bytes, cmap: Dict[int, str]) -> str:
    clean = re.sub(rb"\s+", b"", hex_raw)
    if len(clean) % 2 == 1:
        clean += b"0"
    try:
        data = bytes.fromhex(clean.decode("ascii"))
    except Exception:
        return ""
    if not data:
        return ""
    if cmap:
        # Try 2-byte codes if any key > 255
        two_byte = any(k > 255 for k in cmap.keys()) or len(data) % 2 == 0
        if two_byte and len(data) >= 2:
            chars = []
            matched = 0
            for i in range(0, len(data) - 1, 2):
                code = (data[i] << 8) | data[i + 1]
                if code in cmap:
                    chars.append(cmap[code])
                    matched += 1
            if matched > 0:
                return "".join(chars)
        chars1 = [cmap[b] for b in data if b in cmap]
        if chars1:
            return "".join(chars1)
    if data.startswith(b"\xfe\xff"):
        return data[2:].decode("utf-16-be", errors="ignore")
    # Printable ASCII / Latin1 fallback
    printable = "".join(chr(b) for b in data if 32 <= b <= 126 or 160 <= b <= 255)
    return printable


def _extract_text_from_content_stream(stream_bytes: bytes, combined_cmap: Dict[int, str]) -> Tuple[str, bool]:
    has_bt = b"BT" in stream_bytes and (b"Tj" in stream_bytes or b"TJ" in stream_bytes or b"'" in stream_bytes)
    if not has_bt:
        return "", False

    chunks: List[str] = []
    for bt_match in re.finditer(rb"\bBT\b(.*?)\bET\b", stream_bytes, re.DOTALL):
        block = bt_match.group(1)
        i = 0
        n = len(block)
        line_parts: List[str] = []
        in_tj_array = False
        while i < n:
            ch = block[i]
            if ch == ord("["):
                in_tj_array = True
                i += 1
            elif ch == ord("]"):
                in_tj_array = False
                i += 1
            elif ch == ord("("):
                depth = 1
                j = i + 1
                while j < n and depth > 0:
                    if block[j] == ord("\\"):
                        j += 2
                        continue
                    if block[j] == ord("("):
                        depth += 1
                    elif block[j] == ord(")"):
                        depth -= 1
                    j += 1
                lit = _decode_pdf_literal(block[i + 1 : j - 1])
                if lit:
                    line_parts.append(lit)
                i = j
            elif ch == ord("<") and (i + 1 >= n or block[i + 1] != ord("<")):
                end_hex = block.find(b">", i + 1)
                if end_hex != -1:
                    hex_txt = _decode_hex_string(block[i + 1 : end_hex], combined_cmap)
                    if hex_txt:
                        line_parts.append(hex_txt)
                    i = end_hex + 1
                else:
                    i += 1
            elif in_tj_array and (ch == ord("-") or (48 <= ch <= 57)):
                num_m = re.match(rb"-?\d+(?:\.\d+)?", block[i:])
                if num_m:
                    try:
                        val = float(num_m.group(0))
                        if val <= -120 and line_parts and not line_parts[-1].endswith((" ", "\n")):
                            line_parts.append(" ")
                    except Exception:
                        pass
                    i += len(num_m.group(0))
                else:
                    i += 1
            elif block[i : i + 2] in (b"Td", b"TD", b"T*", b"Tm"):
                if line_parts and not line_parts[-1].endswith(("\n", " ")):
                    line_parts.append("\n" if block[i : i + 2] in (b"T*", b"TD", b"Td") else " ")
                i += 2
            else:
                i += 1
        joined = "".join(line_parts).strip()
        if joined:
            chunks.append(joined)

    result = "\n".join(chunks)
    result = re.sub(r"[ \t]+", " ", result)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip(), True


def extract_with_pure_python(
    pdf_path: str, render_dir: Optional[str], dpi: int
) -> Dict[str, Any]:
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    objects, root_id = _parse_pdf_objects(pdf_bytes)
    page_ids = _collect_page_ids(objects, root_id)
    gs_bin = find_ghostscript()

    # Build global ToUnicode CMap lookup from font CMaps
    global_cmap: Dict[int, str] = {}
    for oid, (d, s) in objects.items():
        if s is not None and (b"beginbfchar" in s or b"beginbfrange" in s or b"ToUnicode" in d):
            decompressed = _decompress_stream(d, s)
            if b"beginbfchar" in decompressed or b"beginbfrange" in decompressed:
                global_cmap.update(_parse_tounicode_cmap(decompressed))

    # Also locate /ToUnicode referenced streams
    for oid, (d, _) in objects.items():
        for m in re.finditer(rb"/ToUnicode\s+(\d+)\s+\d+\s+R", d):
            cmap_oid = int(m.group(1))
            if cmap_oid in objects:
                cd, cs = objects[cmap_oid]
                decompressed = _decompress_stream(cd, cs)
                global_cmap.update(_parse_tounicode_cmap(decompressed))

    pages_out: List[Dict[str, Any]] = []
    used_gs_text = False

    if not page_ids:
        # Minimal fallback if PDF page tree could not be resolved
        page_ids = [-1]

    for idx, pid in enumerate(page_ids):
        page_num = idx + 1
        text = ""
        image_count = 0
        has_text_ops = False

        if pid != -1 and pid in objects:
            page_dict, _ = objects[pid]

            # Count image XObjects on this page
            if b"/Image" in page_dict or b"/DCTDecode" in page_dict:
                image_count += 1
            for rm in _REF_RE.finditer(page_dict):
                ref_id = int(rm.group(1))
                if ref_id in objects:
                    rd = objects[ref_id][0]
                    if b"/Subtype /Image" in rd or b"/Subtype/Image" in rd:
                        image_count += 1

            # Gather /Contents stream refs
            content_refs: List[int] = []
            arr_m = re.search(rb"/Contents\s*\[(.*?)\]", page_dict, re.DOTALL)
            if arr_m:
                content_refs = [int(m.group(1)) for m in _REF_RE.finditer(arr_m.group(1))]
            else:
                single_m = re.search(rb"/Contents\s+(\d+)\s+\d+\s+R", page_dict)
                if single_m:
                    content_refs = [int(single_m.group(1))]

            stream_texts: List[str] = []
            for cid in content_refs:
                if cid in objects:
                    cd, cs = objects[cid]
                    stream_data = _decompress_stream(cd, cs)
                    if b"/Image" in stream_data or b"\nBI\n" in stream_data or b" BI " in stream_data:
                        image_count += 1
                    stxt, has_bt = _extract_text_from_content_stream(stream_data, global_cmap)
                    if has_bt:
                        has_text_ops = True
                    if stxt:
                        stream_texts.append(stxt)
            text = "\n".join(stream_texts).strip()

        # Check preliminary classification; if pure-python couldn't decode text cleanly, try Ghostscript txtwrite
        prelim = classify_page_text(
            text, image_count=image_count, has_text_operators=has_text_ops, engine="python-stdlib"
        )
        engine_tag = "python-stdlib"

        if prelim["isScanned"] and gs_bin:
            gs_text = extract_page_via_gs_txtwrite(gs_bin, pdf_path, page_num)
            if gs_text:
                gs_stats = classify_page_text(
                    gs_text, image_count=image_count, has_text_operators=True, engine="python-gs"
                )
                if not gs_stats["isScanned"]:
                    text = gs_text
                    prelim = gs_stats
                    engine_tag = "python-gs"
                    used_gs_text = True
                    has_text_ops = True

        rendered_path = None
        if prelim["isScanned"] and render_dir and not prelim["needsNodeTextCheck"]:
            os.makedirs(render_dir, exist_ok=True)
            out_png = os.path.join(render_dir, f"page_{page_num}.png")
            if render_page_via_external(pdf_path, page_num, out_png, dpi):
                rendered_path = out_png

        pages_out.append(
            {
                "pageNumber": page_num,
                "text": text,
                "imageCount": image_count,
                "hasTextOperators": has_text_ops,
                "renderedImagePath": rendered_path,
                **prelim,
            }
        )

    return {
        "success": True,
        "engine": "python-gs" if used_gs_text else "python-stdlib",
        "totalPages": max(1, len(pages_out)),
        "metadata": {"title": "", "author": ""},
        "pages": pages_out,
    }


def render_specific_pages(
    pdf_path: str, pages: List[int], render_dir: str, dpi: int
) -> Dict[str, Any]:
    os.makedirs(render_dir, exist_ok=True)
    rendered: Dict[str, Optional[str]] = {}

    # Try PyMuPDF first if available
    try:
        import fitz  # type: ignore

        doc = fitz.open(pdf_path)
        try:
            for p in pages:
                if 1 <= p <= len(doc):
                    out_png = os.path.join(render_dir, f"page_{p}.png")
                    pix = doc[p - 1].get_pixmap(dpi=dpi)
                    pix.save(out_png)
                    rendered[str(p)] = out_png if os.path.exists(out_png) else None
                else:
                    rendered[str(p)] = None
            return {"success": True, "engine": "python-fitz", "rendered": rendered}
        finally:
            doc.close()
    except ImportError:
        pass

    for p in pages:
        out_png = os.path.join(render_dir, f"page_{p}.png")
        ok = render_page_via_external(pdf_path, p, out_png, dpi)
        rendered[str(p)] = out_png if ok else None

    return {"success": True, "engine": "python-external", "rendered": rendered}


def main() -> None:
    parser = argparse.ArgumentParser(description="Python PDF extractor & page classifier")
    parser.add_argument("pdf_path", help="Path to PDF file")
    parser.add_argument("--mode", choices=["extract", "render-pages"], default="extract")
    parser.add_argument("--render-dir", default=None, help="Directory for rendered PNGs")
    parser.add_argument("--pages", default="", help="Comma-separated 1-based pages for render-pages")
    parser.add_argument("--dpi", type=int, default=180, help="Rasterization DPI for scanned pages")
    args = parser.parse_args()

    if not os.path.exists(args.pdf_path):
        print(json.dumps({"success": False, "error": f"File not found: {args.pdf_path}"}))
        sys.exit(1)

    if args.mode == "render-pages":
        if not args.render_dir:
            print(json.dumps({"success": False, "error": "--render-dir required for render-pages"}))
            sys.exit(1)
        page_nums = [int(x.strip()) for x in args.pages.split(",") if x.strip().isdigit()]
        result = render_specific_pages(args.pdf_path, page_nums, args.render_dir, args.dpi)
        print(json.dumps(result, ensure_ascii=False))
        return

    # Mode: extract (Python first!)
    for extractor in (
        try_extract_with_fitz,
        try_extract_with_pdfplumber,
        try_extract_with_pypdf,
    ):
        try:
            res = extractor(args.pdf_path, args.render_dir, args.dpi)
            if res is not None:
                print(json.dumps(res, ensure_ascii=False))
                return
        except Exception:
            continue

    res = extract_with_pure_python(args.pdf_path, args.render_dir, args.dpi)
    print(json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()
