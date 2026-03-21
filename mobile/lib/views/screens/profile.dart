import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:dreamshare/models/user.dart';
import 'package:dreamshare/models/dream.dart';
import 'package:dreamshare/services/auth_service.dart';
import 'package:dreamshare/services/dream_service.dart';
import 'package:dreamshare/views/screens/auth/login.dart';
import 'package:dreamshare/views/screens/edit_profile.dart';
import 'package:dreamshare/views/widgets/dream_card.dart';
import 'package:dreamshare/util/router.dart';

class Profile extends StatefulWidget {
  const Profile({super.key});

  @override
  _ProfileState createState() => _ProfileState();
}

class _ProfileState extends State<Profile> {
  final AuthService _authService = AuthService();
  final DreamService _dreamService = DreamService();
  User? _user;
  List<Dream> _dreams = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() => _isLoading = true);
    try {
      final user = await _authService.getProfile();
      final dreams = await _dreamService.getUserDreams(user.id);
      setState(() {
        _user = user;
        _dreams = dreams;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _logout() async {
    await _authService.logout();
    if (mounted) {
      Navigate.pushPageReplacement(context, const Login());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_user == null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Erro ao carregar perfil'),
              const SizedBox(height: 16),
              ElevatedButton(
                  onPressed: _loadProfile,
                  child: const Text('Tentar novamente')),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('@${_user!.nomeUsuario}'),
        centerTitle: true,
        actions: [
          PopupMenuButton(
            itemBuilder: (_) => [
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, color: Colors.red),
                    SizedBox(width: 8),
                    Text('Sair', style: TextStyle(color: Colors.red)),
                  ],
                ),
              ),
            ],
            onSelected: (value) {
              if (value == 'logout') _logout();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadProfile,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            children: [
              const SizedBox(height: 20),

              // Avatar
              CircleAvatar(
                radius: 50,
                backgroundImage: _user!.avatar != null
                    ? CachedNetworkImageProvider(_user!.avatar!)
                    : null,
                child: _user!.avatar == null
                    ? Text(
                        _user!.nomeUsuario.substring(0, 1).toUpperCase(),
                        style: const TextStyle(
                            fontSize: 36, fontWeight: FontWeight.bold),
                      )
                    : null,
              ),
              const SizedBox(height: 12),

              // Full name
              Text(
                _user!.nomeCompleto,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),

              // Bio
              if (_user!.bio != null && _user!.bio!.isNotEmpty)
                Text(
                  _user!.bio!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey[600], fontSize: 14),
                ),

              const SizedBox(height: 20),

              // Stats
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildStat('Sonhos', _user!.sonhosCount),
                  _buildStat('Seguidores', _user!.seguidoresCount),
                  _buildStat('Seguindo', _user!.seguindoCount),
                ],
              ),

              const SizedBox(height: 16),

              // Edit Profile button
              SizedBox(
                width: 160,
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final result = await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => EditProfile(user: _user!),
                      ),
                    );
                    if (result == true) _loadProfile();
                  },
                  icon: const Icon(Icons.edit, size: 16),
                  label: const Text('Editar Perfil'),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),

              const SizedBox(height: 20),
              const Divider(),
              const SizedBox(height: 8),

              // User dreams
              if (_dreams.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(32),
                  child: Text(
                    'Nenhum sonho publicado ainda',
                    style: TextStyle(color: Colors.grey, fontSize: 16),
                  ),
                )
              else
                ..._dreams.map(
                    (dream) => DreamCard(dream: dream, onUpdate: _loadProfile)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStat(String label, int count) {
    return Column(
      children: [
        Text(
          count.toString(),
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(color: Colors.grey[600]),
        ),
      ],
    );
  }
}
