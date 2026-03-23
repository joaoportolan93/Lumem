import 'user.dart';

class Comment {
  final String id;
  final User? usuario;
  final String conteudoTexto;
  final String? parentId;
  final int curtidasCount;
  final DateTime dataCriacao;
  final List<Comment> respostas;

  Comment({
    required this.id,
    this.usuario,
    required this.conteudoTexto,
    this.parentId,
    this.curtidasCount = 0,
    required this.dataCriacao,
    this.respostas = const [],
  });

  factory Comment.fromJson(Map<String, dynamic> json) {
    return Comment(
      id: (json['id_comentario'] ?? json['id'] ?? '').toString(),
      usuario: json['usuario'] != null
          ? (json['usuario'] is Map<String, dynamic>
              ? User.fromJson(json['usuario'])
              : null)
          : null,
      conteudoTexto: json['conteudo_texto'] ?? '',
      parentId: json['comentario_pai']?.toString(),
      curtidasCount: json['likes_count'] ?? json['curtidas_count'] ?? json['reacoes_count'] ?? 0,
      dataCriacao: json['data_comentario'] != null
          ? DateTime.parse(json['data_comentario'])
          : (json['data_criacao'] != null
              ? DateTime.parse(json['data_criacao'])
              : DateTime.now()),
      respostas: json['respostas'] != null
          ? (json['respostas'] as List)
              .map((r) => Comment.fromJson(r))
              .toList()
          : [],
    );
  }
}
