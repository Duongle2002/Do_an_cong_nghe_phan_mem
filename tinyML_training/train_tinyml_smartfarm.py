from __future__ import annotations

import argparse
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split

FEATURE_COLUMNS = ["temp", "hum", "soil", "lux"]
LABEL_COLUMNS = ["fan", "light", "pump"]
FEATURE_RANGES = {
    "temp": (15.0, 45.0),
    "hum": (0.0, 100.0),
    "soil": (0.0, 100.0),
    "lux": (0.0, 5000.0),
}


@dataclass(frozen=True)
class TrainArtifacts:
    model_path: Path
    scaler_path: Path


def normalize_features(frame: pd.DataFrame) -> np.ndarray:
    values = []
    for column in FEATURE_COLUMNS:
        lower, upper = FEATURE_RANGES[column]
        series = frame[column].astype(np.float32).clip(lower, upper)
        values.append(((series - lower) / (upper - lower)).to_numpy(dtype=np.float32))
    return np.stack(values, axis=1)


def load_dataset(csv_path: Path) -> pd.DataFrame:
    frame = pd.read_csv(csv_path)
    missing = [column for column in FEATURE_COLUMNS + LABEL_COLUMNS if column not in frame.columns]
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")
    frame = frame[FEATURE_COLUMNS + LABEL_COLUMNS].copy()
    for column in FEATURE_COLUMNS + LABEL_COLUMNS:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame = frame.dropna().reset_index(drop=True)
    return frame


def stratified_split(frame: pd.DataFrame, seed: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    label_key = frame[LABEL_COLUMNS].astype(int).astype(str).agg("".join, axis=1)
    train_frame, test_frame = train_test_split(
        frame,
        test_size=0.2,
        random_state=seed,
        stratify=label_key,
    )
    return train_frame.reset_index(drop=True), test_frame.reset_index(drop=True)


def build_model() -> tf.keras.Model:
    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(len(FEATURE_COLUMNS),), name="sensor_input"),
            tf.keras.layers.Dense(8, activation="relu", name="dense_8_relu"),
            tf.keras.layers.Dense(3, activation="sigmoid", name="control_probs"),
        ]
    )
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="binary_crossentropy",
        metrics=[tf.keras.metrics.BinaryAccuracy(name="binary_accuracy")],
    )
    return model


def representative_dataset(x_train: np.ndarray):
    sample_count = min(len(x_train), 128)
    for index in range(sample_count):
        yield [x_train[index : index + 1].astype(np.float32)]


def evaluate_predictions(y_true: np.ndarray, y_prob: np.ndarray) -> dict[str, float]:
    y_pred = (y_prob >= 0.5).astype(np.int32)
    per_label_accuracy = (y_pred == y_true).mean(axis=0)
    exact_match = (y_pred == y_true).all(axis=1).mean()
    return {
        "exact_match_accuracy": float(exact_match),
        "fan_accuracy": float(per_label_accuracy[0]),
        "light_accuracy": float(per_label_accuracy[1]),
        "pump_accuracy": float(per_label_accuracy[2]),
    }


def export_scaler_json(output_path: Path) -> None:
    payload = {
        "features": FEATURE_COLUMNS,
        "labels": LABEL_COLUMNS,
        "feature_ranges": {name: {"min": lower, "max": upper} for name, (lower, upper) in FEATURE_RANGES.items()},
        "normalization": "(value - min) / (max - min)",
        "input_order": FEATURE_COLUMNS,
        "output_order": LABEL_COLUMNS,
        "activation_thresholds": {"on": 0.6, "off": 0.45},
    }
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def quantize_and_export(model: tf.keras.Model, x_train: np.ndarray, artifacts: TrainArtifacts) -> Path:
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = lambda: representative_dataset(x_train)
    # Request full integer quantization (weights + activations)
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    tflite_model = converter.convert()
    artifacts.model_path.write_bytes(tflite_model)
    return artifacts.model_path


def convert_tflite_to_header(tflite_path: Path, header_output: Path, symbol: str = "model_tflite") -> None:
    script = Path(__file__).parent / "tflite_to_model_h.py"
    if not script.exists():
        raise FileNotFoundError(f"Conversion script not found: {script}")
    cmd = [
        str(script),
        "--input",
        str(tflite_path),
        "--output",
        str(header_output),
        "--symbol",
        symbol,
    ]
    print("Running:", " ".join(cmd))
    subprocess.check_call(["python", *cmd])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a tiny int8 Smart Farm model for ESP32-S3")
    parser.add_argument("--csv", type=Path, default=Path("dataset_tinyml_10000.csv"), help="Training CSV path")
    parser.add_argument("--output-dir", type=Path, default=Path("artifacts"), help="Directory for exported files")
    parser.add_argument("--header-output", type=Path, default=Path("../code_esp32/esp32_s3_mqtt_broker_controller/model.h"), help="Path to write C header for ESP32 (relative to tinyML_training)")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--no-quantize", action="store_true", help="Skip int8 quantization and export float TFLite")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    frame = load_dataset(args.csv)
    train_frame, test_frame = stratified_split(frame, args.seed)

    x_train = normalize_features(train_frame)
    x_test = normalize_features(test_frame)
    y_train = train_frame[LABEL_COLUMNS].astype(np.float32).to_numpy()
    y_test = test_frame[LABEL_COLUMNS].astype(np.float32).to_numpy()

    model = build_model()
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=15,
            restore_best_weights=True,
        )
    ]

    model.fit(
        x_train,
        y_train,
        validation_split=0.15,
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=callbacks,
        verbose=2,
    )

    metrics = model.evaluate(x_test, y_test, verbose=0, return_dict=True)
    y_prob = model.predict(x_test, verbose=0)
    report = evaluate_predictions(y_test.astype(np.int32), y_prob)

    print("Keras metrics:", json.dumps({key: float(value) for key, value in metrics.items()}, indent=2))
    print("Prediction report:", json.dumps(report, indent=2))

    model_path = args.output_dir / "model.tflite"
    scaler_path = args.output_dir / "scaler.json"
    artifacts = TrainArtifacts(model_path=model_path, scaler_path=scaler_path)
    if args.no_quantize:
        # export float32 TFLite
        converter = tf.lite.TFLiteConverter.from_keras_model(model)
        tflite_bytes = converter.convert()
        artifacts.model_path.write_bytes(tflite_bytes)
    else:
        quantize_and_export(model, x_train, artifacts)
    export_scaler_json(scaler_path)

    # also produce C header for embedding in ESP32 project
    try:
        header_path = (Path(__file__).parent / args.header_output).resolve()
        convert_tflite_to_header(artifacts.model_path, header_path)
        print(f"Wrote header to: {header_path}")
    except Exception as e:
        print("Warning: failed to generate header:", e)

    print(f"Saved TFLite model to: {model_path}")
    print(f"Saved scaler JSON to: {scaler_path}")
    print(f"TFLite size: {model_path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
