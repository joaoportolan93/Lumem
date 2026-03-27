import 'package:flutter/material.dart';
import 'package:lumem/models/user.dart';
import 'package:lumem/models/dream.dart';
import 'package:lumem/models/community.dart';
import 'package:lumem/services/user_service.dart';
import 'package:lumem/services/dream_service.dart';
import 'package:lumem/services/community_service.dart';
import 'package:lumem/views/widgets/dream_card.dart';
import 'package:lumem/views/widgets/profile_header.dart';

class UserProfile extends StatefulWidget {
  final String userId;

  const UserProfile({super.key, required this.userId});

  @override
  _UserProfileState createState() => _UserProfileState();
}

class _UserProfileState extends State<UserProfile> {
  final UserService _userService = UserService();
  final DreamService _dreamService = DreamService();
  final CommunityService _communityService = CommunityService();

  User? _user;
  bool _isLoading = true;
  String _followStatus = 'none';
  bool _isFollowLoading = false;

  List<Dream> _dreams = [];
  List<Dream> _mediaPosts = [];

  String _communitySubTab = 'posts';
  List<Dream> _communityPosts = [];
  List<Community> _memberCommunities = [];
  List<Community> _adminCommunities = [];
  bool _canSeeDetails = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() => _isLoading = true);
    try {
      final user = await _userService.getUserDetail(widget.userId);
      _user = user;
      _followStatus = user?.followStatus ?? 'none';

      bool canSeeDetails = user != null && (!user.isPrivate || _followStatus == 'following');
      _canSeeDetails = canSeeDetails;

      if (canSeeDetails) {
        final responses = await Future.wait([
          _dreamService.getUserDreams(user.id),
          _dreamService.getUserCommunityPosts(user.id),
          _dreamService.getUserMediaPosts(user.id),
          _communityService.getUserMemberCommunities(user.id),
          _communityService.getUserAdminCommunities(user.id),
        ]);

        _dreams = responses[0] as List<Dream>;
        _communityPosts = responses[1] as List<Dream>;
        _mediaPosts = responses[2] as List<Dream>;
        _memberCommunities = responses[3] as List<Community>;
        _adminCommunities = responses[4] as List<Community>;
      }

      setState(() => _isLoading = false);
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleFollow() async {
    setState(() => _isFollowLoading = true);
    
    if (_followStatus == 'following' || _followStatus == 'pending') {
      final success = await _userService.unfollowUser(widget.userId);
      if (success) {
        setState(() {
          _followStatus = 'none';
          _isFollowLoading = false;
        });
        _loadProfile();
      } else {
        setState(() => _isFollowLoading = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Falha na operação. Tente novamente.')),
          );
        }
      }
    } else {
      final newStatus = await _userService.followUser(widget.userId);
      if (newStatus != null) {
        setState(() {
          _followStatus = newStatus;
          _isFollowLoading = false;
        });
        _loadProfile();
      } else {
        setState(() => _isFollowLoading = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Falha na operação. Tente novamente.')),
          );
        }
      }
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
        appBar: AppBar(),
        body: const Center(child: Text('Usuário não encontrado')),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvoked: (didPop) {
        if (didPop) return;
        Navigator.pop(context, _followStatus);
      },
      child: DefaultTabController(
        length: 3, // Outros perfis nao possuem aba 'Salvos'
        child: Scaffold(
          appBar: AppBar(
            elevation: 0,
            backgroundColor: Colors.transparent,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => Navigator.pop(context, _followStatus),
            ),
          ),
        body: NestedScrollView(
          headerSliverBuilder: (context, innerBoxIsScrolled) {
            return [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: ProfileHeader(
                    user: _user!,
                    isOwnProfile: false,
                    followStatus: _followStatus,
                    isFollowLoading: _isFollowLoading,
                    onFollowToggle: _toggleFollow,
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
                    ],
                  ),
                ),
              ),
            ];
          },
          body: TabBarView(
            children: [
              _canSeeDetails ? _buildDreamsList(_dreams, 'Nenhum sonho publicado ainda', Icons.nights_stay) : _buildLockedMessage(),
              _canSeeDetails ? _buildCommunityTab() : _buildLockedMessage(),
              _canSeeDetails ? _buildDreamsList(_mediaPosts, 'Nenhum post com mídia ainda', Icons.image) : _buildLockedMessage(),
            ],
          ),
        ), // NestedScrollView
      ), // Scaffold
    ), // DefaultTabController
    ); // PopScope
  }

  Widget _buildLockedMessage() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.lock, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          const Text(
            'Esta conta é privada',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              'Siga para ver os sonhos e atividades desta pessoa.',
              style: TextStyle(color: Colors.grey),
              textAlign: TextAlign.center,
            ),
          ),
        ],
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
