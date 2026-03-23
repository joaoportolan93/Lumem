class Community {
  final String id;
  final String nome;
  final String? descricao;
  final String? avatar;
  final String? banner;
  final String? imagem;
  final List<dynamic>? regras;
  final String? cargo;
  final int membrosCount;
  final bool isMembro;
  final DateTime dataCriacao;

  Community({
    required this.id,
    required this.nome,
    this.descricao,
    this.avatar,
    this.banner,
    this.imagem,
    this.regras,
    this.cargo,
    this.membrosCount = 0,
    this.isMembro = false,
    required this.dataCriacao,
  });

  factory Community.fromJson(Map<String, dynamic> json) {
    return Community(
      id: json['id_comunidade'] ?? json['id'] ?? '',
      nome: json['nome'] ?? '',
      descricao: json['descricao'],
      avatar: json['avatar'],
      banner: json['banner'],
      imagem: json['imagem'],
      regras: json['regras'] as List<dynamic>?,
      cargo: json['cargo'],
      membrosCount: json['membros_count'] ?? 0,
      isMembro: json['is_membro'] ?? false,
      dataCriacao: json['data_criacao'] != null
          ? DateTime.parse(json['data_criacao'])
          : DateTime.now(),
    );
  }
}
