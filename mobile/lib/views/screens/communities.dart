import 'package:flutter/material.dart';
import 'package:dreamshare/models/community.dart';
import 'package:dreamshare/services/community_service.dart';
import 'package:dreamshare/views/screens/community_detail.dart';
import 'package:dreamshare/views/screens/create_community.dart';

class Communities extends StatefulWidget {
  const Communities({super.key});

  @override
  _CommunitiesState createState() => _CommunitiesState();
}

class _CommunitiesState extends State<Communities> {
  final CommunityService _communityService = CommunityService();
  List<Community> _communities = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadCommunities();
  }

  Future<void> _loadCommunities() async {
    setState(() => _isLoading = true);
    final communities = await _communityService.getCommunities();
    setState(() {
      _communities = communities;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Comunidades',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _communities.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.holiday_village_rounded,
                          size: 64, color: Colors.grey),
                      SizedBox(height: 16),
                      Text(
                        'Nenhuma comunidade encontrada',
                        style: TextStyle(fontSize: 18, color: Colors.grey),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadCommunities,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _communities.length,
                    itemBuilder: (context, index) {
                      final community = _communities[index];
                      return _buildCommunityCard(community);
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const CreateCommunityScreen()),
          ).then((_) => _loadCommunities());
        },
        icon: const Icon(Icons.add),
        label: const Text('Nova Comunidade'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Colors.white,
      ),
    );
  }

  Widget _buildCommunityCard(Community community) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ListTile(
        contentPadding: const EdgeInsets.all(12),
        leading: CircleAvatar(
          radius: 28,
          backgroundColor:
              Theme.of(context).colorScheme.secondary.withValues(alpha: 0.2),
          child: Text(
            community.nome.substring(0, 1).toUpperCase(),
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 20,
              color: Theme.of(context).colorScheme.secondary,
            ),
          ),
        ),
        title: Text(
          community.nome,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (community.descricao != null) ...[
              const SizedBox(height: 4),
              Text(
                community.descricao!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Colors.grey[600], fontSize: 13),
              ),
            ],
            const SizedBox(height: 4),
            Text(
              '${community.membrosCount} membros',
              style: TextStyle(color: Colors.grey[500], fontSize: 12),
            ),
          ],
        ),
        trailing: community.isMembro
            ? Chip(
                label: const Text('Membro', style: TextStyle(fontSize: 11)),
                backgroundColor: Theme.of(context)
                    .colorScheme
                    .secondary
                    .withValues(alpha: 0.1),
              )
            : null,
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CommunityDetail(communityId: community.id),
            ),
          );
        },
      ),
    );
  }
}
