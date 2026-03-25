import 'user.dart';

class Dream {
  final String id;
  final User? usuario;
  final String conteudoTexto;
  final String? imagem;
  final String? video;
  final List<String> hashtags;
  final int curtidasCount;
  final int comentariosCount;
  final int viewsCount;
  final bool isLiked;
  final bool isSaved;
  final bool isOwner;
  final DateTime dataPublicacao;
  final String? comunidadeId;
  final String? comunidadeNome;

  Dream({
    required this.id,
    this.usuario,
    required this.conteudoTexto,
    this.imagem,
    this.video,
    this.hashtags = const [],
    this.curtidasCount = 0,
    this.comentariosCount = 0,
    this.viewsCount = 0,
    this.isLiked = false,
    this.isSaved = false,
    this.isOwner = false,
    required this.dataPublicacao,
    this.comunidadeId,
    this.comunidadeNome,
  });

  factory Dream.fromJson(Map<String, dynamic> json) {
    // Parse hashtags from different possible formats
    List<String> parseHashtags(dynamic hashtagsData) {
      if (hashtagsData == null) return [];
      if (hashtagsData is List) {
        return hashtagsData.map((h) {
          if (h is String) return h;
          if (h is Map) return h['texto_hashtag']?.toString() ?? '';
          return '';
        }).where((h) => h.isNotEmpty).toList();
      }
      return [];
    }

    return Dream(
      id: json['id_publicacao'] ?? json['id'] ?? '',
      usuario: json['usuario'] != null
          ? (json['usuario'] is Map<String, dynamic>
              ? User.fromJson(json['usuario'])
              : null)
          : null,
      conteudoTexto: json['conteudo_texto'] ?? '',
      imagem: json['imagem'],
      video: json['video'],
      hashtags: parseHashtags(json['hashtags']),
      curtidasCount: json['likes_count'] ?? json['curtidas_count'] ?? json['reacoes_count'] ?? 0,
      comentariosCount: json['comentarios_count'] ?? 0,
      viewsCount: json['views_count'] ?? 0,
      isLiked: json['is_liked'] ?? json['user_has_reacted'] ?? false,
      isSaved: json['is_saved'] ?? json['user_has_saved'] ?? false,
      isOwner: json['is_owner'] ?? false,
      dataPublicacao: json['data_publicacao'] != null
          ? DateTime.parse(json['data_publicacao'])
          : DateTime.now(),
      comunidadeId: json['comunidade']?.toString(),
      comunidadeNome: json['comunidade_nome'],
    );
  }
}
