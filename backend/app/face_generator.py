# backend/app/face_generator.py

import hashlib
import numpy as np
import math

class FaceParameters:
    def __init__(self):
        self.face_shape_type = 0.5; self.face_width = 0.5; self.face_height = 0.5;
        self.jaw_shape = 0.5; self.eye_size = 0.5; self.eye_spacing = 0.5;
        self.eye_color_hue = 0.5; self.mouth_width = 0.5;
        self.mouth_curve = 0.5; self.skin_tone_hue = 0.5; self.skin_tone_saturation = 0.5;
        self.forehead_pattern = 0.5; self.antenna_type = 0.5; self.antenna_length = 0.5;
        self.asymmetry_factor = 0.5;
        # NEW: Functional Parameters
        self.armor_plating = 0.0;
        self.glow_intensity = 0.5;
        
    def from_dict(self, params_dict: dict):
        if not params_dict: return self
        for key, value in params_dict.items():
            if hasattr(self, key) and value is not None: setattr(self, key, value)
        return self

def normalize_face_parameters(face: FaceParameters) -> FaceParameters:
    for attr, value in face.__dict__.items():
        if isinstance(value, (int, float)): setattr(face, attr, max(0.0, min(1.0, value)))
    return face

def map_genome_to_face(genome_hash: str, metrics: dict, cluster_id: str = "Unknown", mode: str = "signature") -> FaceParameters:
    face = FaceParameters()
    hash_bytes = bytes.fromhex(genome_hash)
    
    if mode == "label":
        genus = cluster_id.split()[0] if cluster_id else "Unknown"
        genus_hash = hashlib.md5(genus.encode()).digest()
        face.skin_tone_hue = (genus_hash[0] / 255.0)
        face.skin_tone_saturation = 0.3 + (genus_hash[1] / 255.0) * 0.5
        species_hash = hashlib.md5(cluster_id.encode()).digest()
        face.face_shape_type = (species_hash[0] % 3) / 2.0
        face.antenna_type = (species_hash[1] % 3) / 2.0
        face.forehead_pattern = (species_hash[2] / 255.0)
    else:
        rscu = metrics.get('rscu', {})
        top_codons = sorted(rscu.items(), key=lambda x: x[1], reverse=True)[:5]
        rscu_seed = "-".join([f"{k}:{round(v, 2)}" for k, v in top_codons])
        cpg = metrics.get('cpg_odds', 0.5)
        entropy = metrics.get('signature_entropy', 0.5)
        gc = metrics.get('gc_content', 0.5)
        skew = metrics.get('gc_skew', 0.5)
        bio_seed = f"RSCU:{rscu_seed}-GC:{gc}-CPG:{cpg}-ENT:{entropy}-SK:{skew}"
        bio_hash = hashlib.sha256(bio_seed.encode()).digest()
        hue_raw = (bio_hash[0] << 8) | bio_hash[1]
        face.skin_tone_hue = (hue_raw / 65535.0)
        face.skin_tone_saturation = 0.3 + (bio_hash[2] / 255.0) * 0.6
        face.face_shape_type = (bio_hash[3] % 3) / 2.0
        face.antenna_type = (bio_hash[4] % 3) / 2.0
        face.forehead_pattern = (bio_hash[5] / 255.0)

    # Biometric Constants with Individual Vividness Boost
    # We blend the global metric (70%) with the unique hash entropy (30%)
    # This preserves the Species/Genus "Anchor" while ensuring every individual looks distinct.
    
    face.face_width = (metrics.get('gc_content', 0.5) * 0.7) + (hash_bytes[10] / 255.0 * 0.3)
    face.face_height = ((metrics.get('cpg_odds', 0.5) + 0.5) / 2.0 * 0.7) + (hash_bytes[11] / 255.0 * 0.3)
    face.eye_size = (metrics.get('signature_entropy', 0.5) * 0.6) + (hash_bytes[12] / 255.0 * 0.4)
    face.jaw_shape = (metrics.get('gc_skew', 0.5) * 0.7) + (hash_bytes[13] / 255.0 * 0.3)
    
    face.eye_color_hue = (hash_bytes[1] / 255.0)
    face.eye_spacing = 0.4 + (hash_bytes[7] / 255.0) * 0.4
    face.mouth_curve = (hash_bytes[8] / 255.0)
    face.mouth_width = (metrics.get('purine_ratio', 0.5) * 0.7) + (hash_bytes[14] / 255.0 * 0.3)
    
    face.asymmetry_factor = (hash_bytes[6] / 255.0) * 0.25
    face.antenna_length = 0.2 + abs(metrics.get('gc_skew', 0.5) - 0.5) * 3.0 + (hash_bytes[15] / 255.0 * 1.5)
    
    # FUNCTIONAL MAPPING
    face.armor_plating = metrics.get('coding_robustness', 0.0)
    face.glow_intensity = 0.3 + metrics.get('hydrophobic_ratio', 0.5) * 0.7

    return normalize_face_parameters(face)

def blend_face_parameters(unique_params: FaceParameters, prototype_params: FaceParameters, similarity_score: float) -> FaceParameters:
    blended = FaceParameters()
    unique_weight = 1.0 - similarity_score
    for param_name in blended.__dict__.keys():
        unique_val = getattr(unique_params, param_name)
        proto_val = getattr(prototype_params, param_name)
        if 'type' in param_name or 'pattern' in param_name:
            setattr(blended, param_name, proto_val if similarity_score > 0.6 else unique_val)
        else:
            setattr(blended, param_name, (unique_val * unique_weight) + (proto_val * similarity_score))
    return normalize_face_parameters(blended)

def generate_svg_face(face_params: FaceParameters, width: int = 400, height: int = 500) -> str:
    return "<svg></svg>"

def genome_to_face_complete(genome_sequence: str, cluster_id: str = "Unknown", mode: str = "signature") -> dict:
    import hashlib
    from .genomic_metrics import compute_all_metrics
    metrics = compute_all_metrics(genome_sequence)
    h = hashlib.sha256(genome_sequence.encode()).hexdigest()
    params = map_genome_to_face(h, metrics, cluster_id, mode)
    return {'genome_hash': h, 'face_parameters': params.__dict__, 'bio_features': metrics}
