# backend/app/genomic_metrics.py

import collections
from Bio.Data import CodonTable

def get_codon_usage(sequence: str, genetic_code_id=11) -> dict:
    """
    Calculates the frequency of each codon in a given DNA sequence.

    Args:
        sequence: The DNA sequence string.
        genetic_code_id: The NCBI genetic code ID. Defaults to 11 (Bacterial).

    Returns:
        A dictionary mapping each codon to its count.
    """
    codon_counts = collections.defaultdict(int)
    # Ensure sequence is uppercase and valid for codon parsing
    sequence = sequence.upper()
    for i in range(0, len(sequence) - (len(sequence) % 3), 3):
        codon = sequence[i:i+3]
        if 'N' not in codon: # Skip codons with ambiguous bases
            codon_counts[codon] += 1
    return dict(codon_counts)

def calculate_rscu(codon_counts: dict, genetic_code_id=11) -> dict:
    """
    Calculates the Relative Synonymous Codon Usage (RSCU) values.

    RSCU is the observed frequency of a codon divided by its expected frequency
    under the assumption of equal usage of synonymous codons for an amino acid.

    Args:
        codon_counts: A dictionary of codon counts from get_codon_usage.
        genetic_code_id: The NCBI genetic code ID.

    Returns:
        A dictionary mapping each codon to its RSCU value.
    """
    # Get the codon table for the specified genetic code
    codon_table = CodonTable.unambiguous_dna_by_id[genetic_code_id]

    # Group codons by the amino acid they code for
    synonymous_codons = collections.defaultdict(list)
    for codon, aa in codon_table.forward_table.items():
        synonymous_codons[aa].append(codon)
    
    # Include stop codons in their own group
    synonymous_codons['*'] = codon_table.stop_codons

    rscu_values = {}
    
    # Calculate the total occurrences for each group of synonymous codons
    for aa, codons in synonymous_codons.items():
        total_synonymous_occurrences = sum(codon_counts.get(c, 0) for c in codons)
        num_synonymous_codons = len(codons)

        if total_synonymous_occurrences > 0:
            for codon in codons:
                observed_count = codon_counts.get(codon, 0)
                # Expected frequency if all synonymous codons were used equally
                expected_frequency = total_synonymous_occurrences / num_synonymous_codons
                
                if expected_frequency > 0:
                    rscu_values[codon] = observed_count / expected_frequency
                else:
                    rscu_values[codon] = 0
    
    return rscu_values

import collections
import math
from Bio.Data import CodonTable
from Bio.SeqUtils import gc_fraction

def compute_all_metrics(sequence: str):
    """
    Computes all genomic metrics including biometric signature signals.
    """
    sequence = sequence.upper()
    codon_counts = get_codon_usage(sequence)
    rscu = calculate_rscu(codon_counts)
    
    # 1. GC Metrics
    gc = gc_fraction(sequence) if sequence else 0.0
    g = sequence.count('G')
    c = sequence.count('C')
    gc_skew = (g - c) / (g + c) if (g + c) > 0 else 0.0
    
    # 2. CpG Odds Ratio
    cg_obs = sequence.count('CG') / (len(sequence) - 1) if len(sequence) > 1 else 0.0
    c_freq = c / len(sequence) if len(sequence) > 0 else 0.5
    g_freq = g / len(sequence) if len(sequence) > 0 else 0.5
    cpg_odds = cg_obs / (c_freq * g_freq) if (c_freq * g_freq) > 0 else 1.0
    
    # 3. K-mer Entropy (Tetranucleotides)
    if len(sequence) >= 4:
        t_counts = collections.Counter([sequence[i:i+4] for i in range(len(sequence)-3)])
        t_total = sum(t_counts.values())
        entropy = -sum((v/t_total) * math.log2(v/t_total) for v in t_counts.values()) / 8.0
    else:
        entropy = 0.5

    # 4. Functional Proxies
    # Hydrophobic Ratio often correlates with structural protein density
    hydro = (sequence.count('A') + sequence.count('T')) / len(sequence) if sequence else 0.5
    # Purine Ratio: (A+G) / (T+C)
    a_count = sequence.count('A'); g_count = sequence.count('G')
    t_count = sequence.count('T'); c_count = sequence.count('C')
    purine_ratio = (a_count + g_count) / (t_count + c_count) if (t_count + c_count) > 0 else 1.0
    
    # Coding robustness estimated from RSCU variance
    rscu_vals = [v for v in rscu.values() if v > 0]
    robustness = (sum((v - 1.0)**2 for v in rscu_vals) / len(rscu_vals)) if rscu_vals else 0.0

    metrics = {
        "codon_frequency": codon_counts,
        "rscu": rscu,
        "gc_content": gc,
        "gc_skew": (gc_skew + 1.0) / 2.0,
        "cpg_odds": min(cpg_odds / 2.0, 1.0),
        "signature_entropy": min(entropy, 1.0),
        "hydrophobic_ratio": hydro,
        "purine_ratio": min(purine_ratio / 2.0, 1.0),
        "coding_robustness": min(robustness / 2.0, 1.0),
        "enc": None,
        "cai": None,
    }
    return metrics
