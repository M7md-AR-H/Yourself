# ADR 0001 — On-device AI: Gemma via WebLLM

**Date:** 2026-11-04 · **Status:** accepted (pending real-phone test)

## Context
- The owner wants a local AI ("Gemma from Hugging Face") that can do everything in the app, on a Xiaomi POCO F5 (Snapdragon 7+ Gen 2, Adreno 725, 8/12 GB RAM), later on a laptop.
- Minimal user effort: no account, no token, no setup.

## Options
1. **WebLLM (MLC) in the browser** — WebGPU. Prebuilt Gemma builds on `huggingface.co/mlc-ai` (not gated). Supports JSON-schema-constrained decoding (XGrammar).
2. **MediaPipe LLM Inference (web or Android)** — good Gemma support, but the `litert-community` Gemma files are gated (Hugging Face login + licence click) → extra user effort.
3. **Transformers.js (ONNX)** — works, but no grammar-constrained output; slower on mobile GPUs.
4. **Native Android app** — best performance, but separate code from the laptop, and can't be built/tested in this cloud box.

## Decision
Option 1. Models offered: Gemma 3 1B (default, 0.7 GB), Gemma 2 2B (1.9 GB), Gemma 4 E2B (3.4 GB). The model runs in a Web Worker. Output is forced to a JSON schema (`src/ai/schema.ts`) and then re-validated.

## Consequences
- Needs Chrome with WebGPU (Android Chrome 121+ supports Adreno GPUs).
- If WebGPU or memory turns out bad on the POCO F5, the fallback plan is option 4 (wrap the app with Capacitor and call MediaPipe/LiteRT natively), keeping the same command layer.
