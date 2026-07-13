#!/usr/bin/env python3
"""
transcribe-whisper.py -- run faster-whisper over an audio file and write a
WebVTT caption file in the HH:MM:SS.mmm cue format used by assets/captions/.

Usage:
  python scripts/transcribe-whisper.py <audio-path> <output-vtt-path> \
    [--model medium] [--language en] [--prompt "term list to bias vocabulary"]

Requires: pip install faster-whisper
"""
import argparse
import sys
from pathlib import Path


def format_timestamp(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio_path")
    parser.add_argument("output_vtt_path")
    parser.add_argument("--model", default="medium")
    parser.add_argument("--language", default="en")
    parser.add_argument("--prompt", default="")
    args = parser.parse_args()

    from faster_whisper import WhisperModel

    print(f"Loading model '{args.model}' (CPU, int8) ...", file=sys.stderr)
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    segments, info = model.transcribe(
        args.audio_path,
        language=args.language,
        initial_prompt=args.prompt or None,
        vad_filter=True,
    )

    print(
        f"Detected language '{info.language}' (p={info.language_probability:.2f}), "
        f"duration {info.duration:.1f}s",
        file=sys.stderr,
    )

    lines = ["WEBVTT", ""]
    cue_count = 0
    for segment in segments:
        start = format_timestamp(segment.start)
        end = format_timestamp(segment.end)
        text = segment.text.strip()
        if not text:
            continue
        cue_count += 1
        print(f"[{start} --> {end}] {text}", file=sys.stderr)
        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")

    Path(args.output_vtt_path).write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {cue_count} cues to {args.output_vtt_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
