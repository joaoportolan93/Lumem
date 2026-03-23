class User {
  final String id;
  final String nomeUsuario;
  final String email;
  final String nomeCompleto;
  final String? avatar;
  final String? bio;
  final int seguidoresCount;
  final int seguindoCount;
  final int sonhosCount;
  final bool isFollowing;
  final bool isPrivate;
  final bool isCloseFriend;
  final DateTime? dataNascimento;
  final String followStatus; // 'following', 'pending', 'none'

  User({
    required this.id,
    required this.nomeUsuario,
    required this.email,
    required this.nomeCompleto,
    this.avatar,
    this.bio,
    this.seguidoresCount = 0,
    this.seguindoCount = 0,
    this.sonhosCount = 0,
    this.isFollowing = false,
    this.isPrivate = false,
    this.isCloseFriend = false,
    this.dataNascimento,
    this.followStatus = 'none',
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id_usuario']?.toString() ?? json['id']?.toString() ?? '',
      nomeUsuario: json['nome_usuario'] ?? '',
      email: json['email'] ?? '',
      nomeCompleto: json['nome_completo'] ?? '',
      avatar: json['avatar_url'] ?? json['avatar'],
      bio: json['bio'],
      seguidoresCount: json['seguidores_count'] ?? 0,
      seguindoCount: json['seguindo_count'] ?? 0,
      sonhosCount: json['sonhos_count'] ?? json['publicacoes_count'] ?? 0,
      isFollowing: json['is_following'] == true,
      isPrivate:
          (json['privacidade_padrao'] ?? 1) == 2 || json['is_private'] == true,
      isCloseFriend: json['is_close_friend'] == true,
      dataNascimento: json['data_nascimento'] != null
          ? DateTime.tryParse(json['data_nascimento'])
          : null,
      followStatus: json['follow_status'] ?? 
          (json['is_following'] == true ? 'following' : 'none'),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id_usuario': id,
      'nome_usuario': nomeUsuario,
      'email': email,
      'nome_completo': nomeCompleto,
      'avatar': avatar,
      'bio': bio,
    };
  }
}
