"""
Qubit Hamiltonians for H2 (STO-3G) used by the VQE lab in the quantum-oncology course.

    pip install pyscf numpy
    python3 scripts/oncology/h2_hamiltonians.py > src/plugins/oncology/h2-data.json

For each bond length: restricted Hartree–Fock with PySCF, molecular-orbital integrals,
second-quantised Hamiltonian over 4 spin orbitals (0α, 0β, 1α, 1β), Jordan–Wigner
mapping to 4 qubits (qubit k = spin orbital k, q0 written leftmost), and the Pauli
decomposition c_P = Tr(P·H)/16. Energies in hartree. The script checks that the
lowest 2-electron eigenvalue equals PySCF's full-CI energy.
"""
import itertools, json, sys
import numpy as np
from pyscf import gto, scf, ao2mo, fci

I2 = np.eye(2); X = np.array([[0, 1], [1, 0]]); Y = np.array([[0, -1j], [1j, 0]]); Z = np.diag([1, -1])
PAULI = {'I': I2, 'X': X, 'Y': Y, 'Z': Z}
LOWER = np.array([[0, 1], [0, 0]])  # |0><1|: removes an electron from an occupied (|1>) orbital

def kron(*ms):
    out = np.array([[1.0 + 0j]])
    for m in ms: out = np.kron(out, m)
    return out

def annihilator(k, n=4):
    return kron(*([Z] * k + [LOWER] + [I2] * (n - k - 1)))

def hamiltonian(r):
    mol = gto.M(atom=f'H 0 0 0; H 0 0 {r}', basis='sto-3g', unit='Angstrom', verbose=0)
    mf = scf.RHF(mol).run()
    C = mf.mo_coeff
    h = C.T @ mf.get_hcore() @ C
    eri = ao2mo.restore(1, ao2mo.kernel(mol, C), 2)  # chemist (pq|rs)
    e_fci = fci.FCI(mf).kernel()[0]
    a = [annihilator(k) for k in range(4)]
    ad = [m.conj().T for m in a]
    sp = lambda k: (k // 2, k % 2)  # spin orbital -> (spatial, spin)
    H = mol.energy_nuc() * np.eye(16, dtype=complex)
    for p, q in itertools.product(range(4), repeat=2):
        (P, s1), (Q, s2) = sp(p), sp(q)
        if s1 == s2: H += h[P, Q] * ad[p] @ a[q]
    for p, q, r_, s in itertools.product(range(4), repeat=4):
        (P, sp_), (Q, sq), (R, sr), (S, ss) = sp(p), sp(q), sp(r_), sp(s)
        if sp_ == sr and sq == ss:  # <pq|rs> = (pr|qs)
            H += 0.5 * eri[P, R, Q, S] * ad[p] @ ad[q] @ a[s] @ a[r_]
    terms = {}
    for label in itertools.product('IXYZ', repeat=4):
        c = np.trace(kron(*[PAULI[l] for l in label]) @ H).real / 16
        if abs(c) > 1e-10: terms[''.join(label)] = round(c, 10)
    # check: ground state in the 2-electron sector equals FCI
    two = [z for z in range(16) if bin(z).count('1') == 2]
    e0 = np.linalg.eigvalsh(H[np.ix_(two, two)]).min()
    assert abs(e0 - e_fci) < 1e-8, (r, e0, e_fci)
    return {'r': r, 'hf': round(mf.e_tot, 10), 'fci': round(e_fci, 10), 'terms': terms}

if __name__ == '__main__':
    rs = [round(0.3 + 0.05 * i, 2) for i in range(45)]  # 0.30 … 2.50 Å
    rows = [hamiltonian(r) for r in rs]
    json.dump({'basis': 'sto-3g', 'units': 'hartree', 'geometries': rows}, sys.stdout, separators=(',', ':'))
