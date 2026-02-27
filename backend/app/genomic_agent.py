# backend/app/genomic_agent.py

def generate_curation_rationale(metrics: dict, cluster_id: str, distance: float):
    """
    Simulates the 'Reasoning' step of an AI Agent.
    Converts raw biometric metrics into a natural language curation report.
    """
    gc = metrics.get('gc_content', 0.5)
    cpg = metrics.get('cpg_odds', 0.5)
    robustness = metrics.get('coding_robustness', 0.0)
    entropy = metrics.get('signature_entropy', 0.5)
    
    # 1. Determine Evolutionary State
    if gc > 0.6:
        structure_note = "high structural stability and thermal resistance."
    elif gc < 0.4:
        structure_note = "low-GC profile, indicating a specialized or potentially extreme environment."
    else:
        structure_note = "balanced nucleotide composition."

    # 2. Determine Selection Pressure
    if cpg < 0.3:
        selection_note = "significant selection pressure (high CpG suppression), typical of complex regulatory systems."
    else:
        selection_note = "relaxed selection pressure, suggesting a more ancestral or less restricted coding sequence."

    # 3. Decision Logic (The 'Agent' part)
    decision = f"Assigned to {cluster_id}."
    if distance < 0.1:
        confidence = "HIGH CONFIDENCE match based on Euclidean Biometric proximity."
    elif distance < 0.3:
        confidence = "MODERATE CONFIDENCE. Notable morphological drift detected from the species prototype."
    else:
        confidence = "LOW CONFIDENCE. Genome shows high divergence; potential candidate for new species designation."

    report = [
        f"AGENT ANALYSIS: Sequence exhibits {structure_note}",
        f"EVOLUTIONARY FOOTPRINT: CpG suppression levels suggest {selection_note}",
        f"CODING STRATEGY: Robustness score of {robustness:.3f} indicates {'highly optimized' if robustness > 0.5 else 'standard'} translation efficiency.",
        f"CLASSIFICATION: {decision} {confidence}"
    ]
    
    return report

def get_agent_trace(step_name: str, action: str, result: str):
    return {
        "step": step_name,
        "tool_used": action,
        "outcome": result
    }
