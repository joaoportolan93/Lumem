import 'package:flutter/material.dart';
import 'package:lumem/models/user.dart';
import 'package:lumem/models/dream.dart';
import 'package:lumem/models/community.dart';
import 'package:lumem/services/auth_service.dart';
import 'package:lumem/services/dream_service.dart';
import 'package:lumem/services/community_service.dart';
import 'package:lumem/views/screens/auth/login.dart';
import 'package:lumem/views/screens/edit_profile.dart';
import 'package:lumem/views/screens/settings.dart';
import 'package:lumem/views/widgets/dream_card.dart';
import 'package:lumem/views/widgets/profile_header.dart';
import 'package:lumem/util/router.dart';

class Profile extends StatefulWidget {
  const Profile({super.key});

  @override
  _ProfileState createState() => _ProfileState();
}

class _ProfileState extends State<Profile> {
  final AuthService _authService = AuthService();
  final DreamService _dreamService = DreamService();
  final CommunityService _communityService = CommunityService();

  User? _user;
  bool _isLoading = true;

  // Tabs de Sonhos, Midia, Salvos
  List<Dream> _dreams = [];
  List<Dream> _mediaPosts = [];
  List<Dream> _savedDreams = [];

  // Tabs de Comunidades
  String _communitySubTab = 'posts'; // 'posts', 'membro', 'admin'
  List<Dream> _communityPosts = [];
  List<Community> _memberCommunities = [];
  List<Community> _adminCommunities = [];

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() => _isLoading = true);
    try {
      final user = await _authService.getProfile();
      final responses = await Future.wait([
        _dreamService.getUserDreams(user.id),
        _dreamService.getUserCommunityPosts(user.id),
        _dreamService.getUserMediaPosts(user.id),
        _dreamService.getSavedDreams(),
        _communityService.getUserMemberCommunities(user.id),
        _communityService.getUserAdminCommunities(user.id),
      ]);

      setState(() {
        _user = user;
        _dreams = responses[0] as List<Dream>;
        _communityPosts = responses[1] as List<Dream>;
        _mediaPosts = responses[2] as List<Dream>;
        _savedDreams = responses[3] as List<Dream>;
        _memberCommunities = responses[4] as List<Community>;
        _adminCommunities = responses[5] as List<Community>;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
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
                  onPressed: _loadProfile, child: const Text('Tentar novamente')),
            ],
          ),
        ),
      );
    }

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        body: NestedScrollView(
          headerSliverBuilder: (context, innerBoxIsScrolled) {
            return [
              SliverToBoxAdapter(
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: ProfileHeader(
                      user: _user!,
                      isOwnProfile: true,
                      actionMenu: PopupMenuButton(
                        icon: const Icon(Icons.more_vert, color: Colors.white),
                        itemBuilder: (_) => [
                          const PopupMenuItem(
                            value: 'settings',
                            child: Row(
                              children: [
                                Icon(Icons.settings, color: Colors.black54),
                                SizedBox(width: 8),
                                Text('Configurações'),
                              ],
                            ),
                          ),
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
                          if (value == 'settings') {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen())).then((_) => _loadProfile());
                          } else if (value == 'logout') {
                            _logout();
                          }
                        },
                      ),
                    onEditProfile: () async {
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => EditProfile(user: _user!),
                        ),
                      );
                      if (result == true) _loadProfile();
                    },
                  ),
                ),
              ),
            ),
            SliverPersistentHeader(
                pinned: true,
                delegate: _SliverAppBarDelegate(
                  const TabBar(
                    isScrollable: false,
                    labelColor: Color(0xFF764BA2),
                    unselectedLabelColor: Colors.grey,
                    indicatorColor: Color(0xFF764BA2),
                    tabs: [
                      Tab(text: 'Sonhos'),
                      Tab(text: 'Comunidades'),
                      Tab(text: 'Mídia'),
                      Tab(text: 'Salvos'),
                    ],
                  ),
                ),
              ),
            ];
          },
          body: TabBarView(
            children: [
              // Aba Sonhos
              _buildDreamsList(_dreams, 'Nenhum sonho publicado ainda', Icons.nights_stay),

              // Aba Comunidades
              _buildCommunityTab(),

              // Aba Midia
              _buildDreamsList(_mediaPosts, 'Nenhum post com mídia ainda', Icons.image),

              // Aba Salvos
              _buildDreamsList(_savedDreams, 'Nenhum sonho salvo ainda', Icons.bookmark_border),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDreamsList(List<Dream> items, String emptyMsg, IconData emptyIcon) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(emptyIcon, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              emptyMsg,
              style: TextStyle(fontSize: 16, color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadProfile,
      child: ListView.builder(
        padding: const EdgeInsets.only(top: 8),
        itemCount: items.length,
        itemBuilder: (context, index) {
          return DreamCard(dream: items[index], onUpdate: _loadProfile);
        },
      ),
    );
  }

  Widget _buildCommunityTab() {
    return Column(
      children: [
        Container(
          height: 50,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildSubTabChip('Posts', 'posts'),
              const SizedBox(width: 8),
              _buildSubTabChip('Membro', 'membro'),
              const SizedBox(width: 8),
              _buildSubTabChip('Admin/Mod', 'admin'),
            ],
          ),
        ),
        Expanded(
          child: Builder(
            builder: (context) {
              if (_communitySubTab == 'posts') {
                return _buildDreamsList(_communityPosts, 'Nenhum post em comunidades.', Icons.supervised_user_circle);
              } else if (_communitySubTab == 'membro') {
                return _buildCommunitiesList(_memberCommunities, 'Não é membro de nenhuma comunidade.');
              } else {
                return _buildCommunitiesList(_adminCommunities, 'Não administra nenhuma comunidade.');
              }
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSubTabChip(String label, String value) {
    final isSelected = _communitySubTab == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) setState(() => _communitySubTab = value);
      },
      selectedColor: const Color(0xFF764BA2),
      labelStyle: TextStyle(color: isSelected ? Colors.white : Colors.black87),
      backgroundColor: Colors.grey[200],
    );
  }

  Widget _buildCommunitiesList(List<Community> comms, String emptyMsg) {
    if (comms.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.group, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              emptyMsg,
              style: TextStyle(fontSize: 16, color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }
    return ListView.builder(
      itemCount: comms.length,
      padding: const EdgeInsets.all(8),
      itemBuilder: (context, index) {
        final c = comms[index];
        return Card(
          elevation: 2,
          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: ListTile(
            leading: CircleAvatar(
              backgroundImage: c.avatar != null ? NetworkImage(c.avatar!) : null,
              child: c.avatar == null ? const Icon(Icons.group) : null,
            ),
            title: Text(c.nome, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('${c.membrosCount} membros'),
            onTap: () {
              // Navegar para detalhe da comunidade (opcional/futuro)
            },
          ),
        );
      },
    );
  }
}

class _SliverAppBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar _tabBar;
  _SliverAppBarDelegate(this._tabBar);

  @override
  double get minExtent => _tabBar.preferredSize.height;
  @override
  double get maxExtent => _tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: _tabBar,
    );
  }

  @override
  bool shouldRebuild(_SliverAppBarDelegate oldDelegate) {
    return false;
  }
}
