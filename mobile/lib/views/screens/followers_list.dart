import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lumem/models/user.dart';
import 'package:lumem/services/user_service.dart';
import 'package:lumem/views/screens/user_profile.dart';

class FollowersList extends StatefulWidget {
  final String userId;
  final String userName;
  final int initialTab; // 0 = seguidores, 1 = seguindo

  const FollowersList({
    super.key,
    required this.userId,
    required this.userName,
    this.initialTab = 0,
  });

  @override
  _FollowersListState createState() => _FollowersListState();
}

class _FollowersListState extends State<FollowersList> {
  final UserService _userService = UserService();
  List<User> _followers = [];
  List<User> _following = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final results = await Future.wait([
      _userService.getFollowers(widget.userId),
      _userService.getFollowing(widget.userId),
    ]);
    setState(() {
      _followers = results[0];
      _following = results[1];
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      initialIndex: widget.initialTab,
      child: Scaffold(
        appBar: AppBar(
          title: Text('@${widget.userName}'),
          centerTitle: true,
          bottom: const TabBar(
            labelColor: Color(0xFF764BA2),
            unselectedLabelColor: Colors.grey,
            indicatorColor: Color(0xFF764BA2),
            tabs: [
              Tab(text: 'Seguidores'),
              Tab(text: 'Seguindo'),
            ],
          ),
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(
                children: [
                  _buildUserList(_followers, 'Nenhum seguidor ainda'),
                  _buildUserList(_following, 'Não segue ninguém ainda'),
                ],
              ),
      ),
    );
  }

  Widget _buildUserList(List<User> users, String emptyMsg) {
    if (users.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.people_outline, size: 64, color: Colors.grey[400]),
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
      onRefresh: _loadData,
      child: ListView.builder(
        itemCount: users.length,
        itemBuilder: (context, index) {
          final user = users[index];
          return ListTile(
            leading: CircleAvatar(
              backgroundImage: user.avatar != null
                  ? CachedNetworkImageProvider(user.avatar!)
                  : null,
              child: user.avatar == null
                  ? Text(user.nomeUsuario.substring(0, 1).toUpperCase(),
                      style: const TextStyle(fontWeight: FontWeight.bold))
                  : null,
            ),
            title: Text(user.nomeCompleto,
                style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('@${user.nomeUsuario}'),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => UserProfile(userId: user.id),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
