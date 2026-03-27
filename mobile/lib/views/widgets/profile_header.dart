import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lumem/models/user.dart';
import 'package:lumem/views/screens/followers_list.dart';

class ProfileHeader extends StatelessWidget {
  final User user;
  final bool isOwnProfile;
  final String followStatus;
  final bool isFollowLoading;
  final VoidCallback? onFollowToggle;
  final VoidCallback? onEditProfile;
  final Widget? actionMenu;

  const ProfileHeader({
    super.key,
    required this.user,
    this.isOwnProfile = false,
    this.followStatus = 'none',
    this.isFollowLoading = false,
    this.onFollowToggle,
    this.onEditProfile,
    this.actionMenu,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        image: DecorationImage(
          image: const CachedNetworkImageProvider(
              'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1471&q=80'),
          fit: BoxFit.cover,
          colorFilter: ColorFilter.mode(
            Colors.black.withOpacity(0.2),
            BlendMode.dstATop,
          ),
        ),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Avatar
              CircleAvatar(
                radius: 40,
                backgroundColor: Colors.white,
                child: Padding(
                  padding: const EdgeInsets.all(3.0),
                  child: CircleAvatar(
                    radius: 37,
                    backgroundImage: user.avatar != null
                        ? CachedNetworkImageProvider(user.avatar!)
                        : null,
                    child: user.avatar == null
                        ? Text(
                            user.nomeUsuario.substring(0, 1).toUpperCase(),
                            style: const TextStyle(
                                fontSize: 28, fontWeight: FontWeight.bold),
                          )
                        : null,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              // Nomes e infos
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.nomeCompleto,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          '@${user.nomeUsuario}',
                          style: const TextStyle(
                            fontSize: 16,
                            color: Colors.white70,
                          ),
                        ),
                        if (user.isPrivate) ...[
                          const SizedBox(width: 4),
                          const Icon(Icons.lock, size: 14, color: Colors.white70),
                        ],
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (user.bio != null && user.bio!.isNotEmpty)
                      Text(
                        user.bio!,
                        style: const TextStyle(
                          fontSize: 14,
                          color: Colors.white,
                          height: 1.3,
                        ),
                      ),
                  ],
                ),
              ),
              if (actionMenu != null) actionMenu!,
            ],
          ),
          const SizedBox(height: 20),
          // Stats
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStat('Sonhos', user.sonhosCount),
              GestureDetector(
                onTap: () => _openFollowersList(context, 0),
                child: _buildStat('Seguidores', user.seguidoresCount),
              ),
              GestureDetector(
                onTap: () => _openFollowersList(context, 1),
                child: _buildStat('Seguindo', user.seguindoCount),
              ),
            ],
          ),
          const SizedBox(height: 20),
          // Botoes Acao
          if (isOwnProfile)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onEditProfile,
                icon: const Icon(Icons.edit, size: 18),
                label: const Text('Editar Perfil'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF764BA2),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                  elevation: 0,
                ),
              ),
            )
          else
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: isFollowLoading ? null : onFollowToggle,
                style: ElevatedButton.styleFrom(
                  backgroundColor: followStatus == 'following' ? Colors.white24 : 
                                   followStatus == 'pending' ? Colors.black26 : Colors.white,
                  foregroundColor: followStatus == 'following' || followStatus == 'pending' ? Colors.white : const Color(0xFF764BA2),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: followStatus == 'following'
                        ? const BorderSide(color: Colors.white, width: 2)
                        : BorderSide.none,
                  ),
                  elevation: 0,
                ),
                child: isFollowLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        followStatus == 'following' ? 'Seguindo' : 
                        followStatus == 'pending' ? 'Solicitado' : 'Seguir',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),
        ],
      ),
    );
  }

  void _openFollowersList(BuildContext context, int tab) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => FollowersList(
          userId: user.id,
          userName: user.nomeUsuario,
          initialTab: tab,
        ),
      ),
    );
  }

  Widget _buildStat(String label, int count) {
    return Column(
      children: [
        Text(
          count.toString(),
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 13,
          ),
        ),
      ],
    );
  }
}
