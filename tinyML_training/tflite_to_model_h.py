from __future__ import annotations

import argparse
from pathlib import Path


def format_bytes(blob: bytes, bytes_per_line: int = 12) -> str:
    lines: list[str] = []
    for start in range(0, len(blob), bytes_per_line):
        chunk = blob[start : start + bytes_per_line]
        lines.append(", ".join(f"0x{byte:02x}" for byte in chunk))
    return ",\n  ".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert model.tflite to a C header for ESP32")
    parser.add_argument("--input", type=Path, default=Path("artifacts/model.tflite"), help="Input TFLite model")
    parser.add_argument("--output", type=Path, default=Path("esp32_s3_mqtt_broker_controller/model.h"), help="Output header path")
    parser.add_argument("--symbol", type=str, default="model_tflite", help="C array symbol name")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    blob = args.input.read_bytes()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    body = format_bytes(blob)

    header = f"""#pragma once

// Generated from {args.input.name}. Do not edit manually.
alignas(16) const unsigned char {args.symbol}[] = {{
  {body}
}};

const unsigned int {args.symbol}_len = {len(blob)};
"""
    args.output.write_text(header, encoding="utf-8")
    print(f"Wrote {args.output} ({len(blob)} bytes)")


if __name__ == "__main__":
    main()
