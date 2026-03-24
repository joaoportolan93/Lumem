class AppNotification {
  final String id;
  final String tipo;
  final String? conteudo;
  final bool lida;
  final DateTime dataCriacao;
  final String? remetenteNome;
  final String? remetenteAvatar;
  final String? remetenteId;
  final String? publicacaoId;

  AppNotification({
    required this.id,
    required this.tipo,
    this.conteudo,
    this.lida = false,
    required this.dataCriacao,
    this.remetenteNome,
    this.remetenteAvatar,
    this.remetenteId,
    this.publicacaoId,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id_notificacao'] ?? json['id'] ?? '',
      tipo: json['tipo_notificacao_display'] ?? json['tipo']?.toString() ?? '',
      conteudo: json['conteudo'],
      lida: json['lida'] ?? false,
      dataCriacao: json['data_criacao'] != null
          ? DateTime.parse(json['data_criacao'])
          : DateTime.now(),
      remetenteNome: json['usuario_origem']?['nome_completo'] ??
          json['usuario_origem']?['nome_usuario'] ??
          json['remetente_nome'] ??
          json['remetente']?['nome_usuario'],
      remetenteAvatar: json['usuario_origem']?['avatar_url'] ??
          json['usuario_origem']?['avatar'] ??
          json['remetente_avatar'] ??
          json['remetente']?['avatar'],
      remetenteId: json['usuario_origem']?['id_usuario']?.toString() ??
          json['remetente']?['id_usuario']?.toString(),
      publicacaoId: json['id_referencia']?.toString() ?? json['publicacao']?.toString(),
    );
  }
}
