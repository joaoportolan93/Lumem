import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:dreamshare/models/user.dart';
import 'package:dreamshare/services/user_service.dart';

class Explore extends StatefulWidget {
  @override
  _ExploreState createState() => _ExploreState();
}

class _ExploreState extends State<Explore> {
  final UserService _userService = UserService();
  final TextEditingController _searchController = TextEditingController();
  List<User> _results = [];
  List<User> _suggested = [];
  bool _isSearching = false;
  bool _isLoadingSuggested = true;
  Timer? _debounce;
  final Set<String> _followedIds = {};

  @override
  void initState() {
    super.initState();
    _loadSuggested();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadSuggested() async {
    final users = await _userService.getSuggestedUsers();
    setState(() {
      _suggested = users;
      _isLoadingSuggested = false;
      // Initialise local follow state from server data
      for (final u in users) {
        if (u.isFollowing) _followedIds.add(u.id);
      }
    });
  }

  void _onSearchChanged(String query) {
    _debounce?.cancel();
    if (query.isEmpty) {
      setState(() {
        _results = [];
        _isSearching = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 500), () async {
      setState(() => _isSearching = true);
      final results = await _userService.search(query);
      setState(() {
        _results = results;
        _isSearching = false;
        // Initialise local follow state from search results
        for (final u in results) {
          if (u.isFollowing) _followedIds.add(u.id);
        }
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _searchController,
          onChanged: _onSearchChanged,
          decoration: InputDecoration(
            hintText: 'Buscar usuários...',
            border: InputBorder.none,
            prefixIcon: const Icon(Icons.search, size: 20),
            suffixIcon: _searchController.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, size: 20),
                    onPressed: () {
                      _searchController.clear();
                      _onSearchChanged('');
                    },
                  )
                : null,
          ),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isSearching) {
      return const Center(child: CircularProgressIndicator());
    }

    // If searching, show search results
    if (_searchController.text.isNotEmpty) {
      if (_results.isEmpty) {
        return const Center(
          child: Text('Nenhum resultado encontrado', style: TextStyle(color: Colors.grey)),
        );
      }
      return _buildUserList(_results);
    }

    // Otherwise, show suggested users
    if (_isLoadingSuggested) {
      return const Center(child: CircularProgressIndicator());
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            'Sugestões para você',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
        Expanded(
          child: _suggested.isEmpty
              ? const Center(
                  child: Text('Nenhuma sugestão disponível', style: TextStyle(color: Colors.grey)),
                )
              : _buildUserList(_suggested),
        ),
      ],
    );
  }

  Widget _buildUserList(List<User> users) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemCount: users.length,
      itemBuilder: (context, index) {
        final user = users[index];
        return ListTile(
          contentPadding: const EdgeInsets.symmetric(vertical: 8),
          leading: CircleAvatar(
            radius: 25,
            backgroundImage: user.avatar != null
                ? CachedNetworkImageProvider(user.avatar!)
                : null,
            child: user.avatar == null
                ? Text(
                    user.nomeUsuario.substring(0, 1).toUpperCase(),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  )
                : null,
          ),
          title: Text(
            user.nomeUsuario,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          subtitle: Text(user.nomeCompleto),
          trailing: TextButton(
            onPressed: () async {
              await _userService.followUser(user.id);
              setState(() {
                if (_followedIds.contains(user.id)) {
                  _followedIds.remove(user.id);
                } else {
                  _followedIds.add(user.id);
                }
              });
            },
            style: TextButton.styleFrom(
              backgroundColor: _followedIds.contains(user.id)
                  ? Colors.grey[300]
                  : Theme.of(context).colorScheme.secondary,
              foregroundColor: _followedIds.contains(user.id) ? Colors.black : Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            child: Text(_followedIds.contains(user.id) ? 'Seguindo' : 'Seguir'),
          ),
          onTap: () {
            // TODO: Navigate to user profile
          },
        );
      },
    );
  }
}
