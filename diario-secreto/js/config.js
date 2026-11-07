/*
 * Configuração dos agentes do Diário Secreto.
 *
 * A senha nunca fica escrita aqui: guardamos só o "hash" SHA-256 de
 *   "diario-secreto|<id do agente>|<senha>"
 *
 * Para trocar uma senha, abra o site, aperte F12 (console) e rode:
 *   gerarHash("noir", "minha-senha-nova")
 * Copie o resultado para o campo `hash` do agente correspondente.
 *
 * Senhas iniciais (troque antes de usar de verdade):
 *   NOIR  -> sombra
 *   BLANC -> neblina
 */
window.DIARIO_CONFIG = {
  agentes: [
    {
      id: "noir",
      codinome: "Noir",
      lema: "Opera nas sombras",
      tom: "escuro",
      hash: "3b2cceb9be0acaab3507a9f865c97ecce4bdda34d191ed22b37d4fe5fbd1fe6f"
    },
    {
      id: "blanc",
      codinome: "Blanc",
      lema: "Desaparece na neblina",
      tom: "claro",
      hash: "ebc0fec15bdf25534b75c49305fbba1aa392569f41bed67c299e2a935c115e14"
    }
  ],

  // Depois de errar a senha este número de vezes, o terminal bloqueia.
  tentativasAntesDoBloqueio: 3,
  segundosDeBloqueio: 30
};
