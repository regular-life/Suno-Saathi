from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

class TinyLlamaLLM:
    def __init__(self):
        model_id = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
        print("[INFO] Loading TinyLlama...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        )
        self.model.eval()
        print("[INFO] TinyLlama loaded.")

    def generate_reply(self, prompt: str, max_new_tokens: int = 100) -> str:
        inputs = self.tokenizer(prompt, return_tensors="pt")
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                top_k=50,
                temperature=0.8,
                top_p=0.95
            )
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        return response.replace(prompt, "").strip()
