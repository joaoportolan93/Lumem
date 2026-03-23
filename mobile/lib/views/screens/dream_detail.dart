import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:dreamshare/models/dream.dart';
import 'package:dreamshare/models/comment.dart';
import 'package:dreamshare/models/user.dart';
import 'package:dreamshare/services/dream_service.dart';
import 'package:dreamshare/services/auth_service.dart';
import 'package:timeago/timeago.dart' as timeago;

class DreamDetail extends StatefulWidget {
  final String dreamId;

  const DreamDetail({super.key, required this.dreamId});

  @override
  _DreamDetailState createState() => _DreamDetailState();
}

class _DreamDetailState extends State<DreamDetail> {
  final DreamService _dreamService = DreamService();
  final AuthService _authService = AuthService();
  final TextEditingController _commentController = TextEditingController();
  Dream? _dream;
  List<Comment> _comments = [];
  bool _isLoading = true;
  bool _isPostingComment = false;
  String? _currentUserId;

  // Like/Save state
  bool _isLiked = false;
  int _likesCount = 0;
  bool _isSaved = false;

  // Reply state
  String? _replyToId;
  String? _replyToUsername;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final dreamFuture = _dreamService.getDreamDetail(widget.dreamId);
      final commentsFuture = _dreamService.getComments(widget.dreamId);
      User? currentUser;
      try {
        currentUser = await _authService.getProfile();
      } catch (_) {}

      final dream = await dreamFuture;
      final comments = await commentsFuture;

      setState(() {
        _dream = dream;
        _comments = comments;
        _currentUserId = currentUser?.id;
        _isLiked = dream?.isLiked ?? false;
        _likesCount = dream?.curtidasCount ?? 0;
        _isSaved = dream?.isSaved ?? false;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleLike() async {
    setState(() {
      _isLiked = !_isLiked;
      _likesCount += _isLiked ? 1 : -1;
      if (_likesCount < 0) _likesCount = 0;
    });

    final success = await _dreamService.likeDream(widget.dreamId);
    if (!success) {
      setState(() {
        _isLiked = !_isLiked;
        _likesCount += _isLiked ? 1 : -1;
        if (_likesCount < 0) _likesCount = 0;
      });
    }
  }

  Future<void> _toggleSave() async {
    setState(() => _isSaved = !_isSaved);

    final success = await _dreamService.saveDream(widget.dreamId);
    if (!success) {
      setState(() => _isSaved = !_isSaved);
    }
  }

  Future<void> _postComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    setState(() => _isPostingComment = true);
    final comment = await _dreamService.createComment(
      widget.dreamId,
      text,
      parentId: _replyToId,
    );
    setState(() => _isPostingComment = false);

    if (comment != null) {
      _commentController.clear();
      setState(() {
        _replyToId = null;
        _replyToUsername = null;
      });
      _loadData();
    }
  }

  void _setReplyTo(Comment comment) {
    setState(() {
      _replyToId = comment.id;
      _replyToUsername = comment.usuario?.nomeUsuario ?? 'Anônimo';
    });
    _commentController.text = '';
    FocusScope.of(context).requestFocus(FocusNode());
  }

  void _cancelReply() {
    setState(() {
      _replyToId = null;
      _replyToUsername = null;
    });
  }

  Future<void> _deleteComment(Comment comment) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir comentário'),
        content: const Text('Tem certeza que deseja excluir este comentário?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Excluir', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final success =
          await _dreamService.deleteComment(widget.dreamId, comment.id);
      if (success) {
        _loadData();
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'Não é possível excluir um comentário com respostas. Exclua as respostas primeiro.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sonho')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _dream == null
              ? const Center(child: Text('Sonho não encontrado'))
              : Column(
                  children: [
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          // Dream header
                          Row(
                            children: [
                              CircleAvatar(
                                radius: 22,
                                backgroundImage:
                                    _dream!.usuario?.avatar != null
                                        ? CachedNetworkImageProvider(
                                            _dream!.usuario!.avatar!)
                                        : null,
                                child: _dream!.usuario?.avatar == null
                                    ? Text(_dream!.usuario?.nomeUsuario
                                            .substring(0, 1)
                                            .toUpperCase() ??
                                        '?')
                                    : null,
                              ),
                              const SizedBox(width: 12),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _dream!.usuario?.nomeCompleto ??
                                        _dream!.usuario?.nomeUsuario ??
                                        'Anônimo',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16),
                                  ),
                                  Text(
                                    '@${_dream!.usuario?.nomeUsuario ?? ''} · ${timeago.format(_dream!.dataPublicacao, locale: 'pt_BR')}',
                                    style: TextStyle(
                                        color: Colors.grey[500], fontSize: 13),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // Dream content
                          Text(
                            _dream!.conteudoTexto,
                            style:
                                const TextStyle(fontSize: 16, height: 1.5),
                          ),

                          // Hashtags
                          if (_dream!.hashtags.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 8,
                              children: _dream!.hashtags.map((tag) {
                                return Text(
                                  tag.startsWith('#') ? tag : '#$tag',
                                  style: TextStyle(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .secondary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                );
                              }).toList(),
                            ),
                          ],

                          // Image
                          if (_dream!.imagem != null) ...[
                            const SizedBox(height: 16),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: CachedNetworkImage(
                                imageUrl: _dream!.imagem!,
                                width: double.infinity,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ],

                          // Action buttons: like, comment count, save
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              // Like
                              InkWell(
                                onTap: _toggleLike,
                                borderRadius: BorderRadius.circular(20),
                                child: Padding(
                                  padding: const EdgeInsets.all(4),
                                  child: Row(
                                    children: [
                                      Icon(
                                        _isLiked
                                            ? Icons.favorite
                                            : Icons.favorite_border,
                                        color: _isLiked
                                            ? Colors.red
                                            : Colors.grey,
                                        size: 22,
                                      ),
                                      const SizedBox(width: 4),
                                      Text('$_likesCount',
                                          style: TextStyle(
                                              color: Colors.grey[600])),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                              // Comment count
                              Row(
                                children: [
                                  const Icon(Icons.chat_bubble_outline,
                                      color: Colors.grey, size: 20),
                                  const SizedBox(width: 4),
                                  Text('${_comments.length}',
                                      style: TextStyle(
                                          color: Colors.grey[600])),
                                ],
                              ),
                              const Spacer(),
                              // Save
                              InkWell(
                                onTap: _toggleSave,
                                borderRadius: BorderRadius.circular(20),
                                child: Padding(
                                  padding: const EdgeInsets.all(4),
                                  child: Icon(
                                    _isSaved
                                        ? Icons.bookmark
                                        : Icons.bookmark_border,
                                    color: _isSaved
                                        ? Theme.of(context)
                                            .colorScheme
                                            .secondary
                                        : Colors.grey,
                                    size: 22,
                                  ),
                                ),
                              ),
                            ],
                          ),

                          const Divider(height: 32),

                          // Comments section
                          const Text(
                            'Comentários',
                            style: TextStyle(
                                fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 12),

                          if (_comments.isEmpty)
                            const Padding(
                              padding: EdgeInsets.all(16),
                              child: Center(
                                child: Text(
                                  'Nenhum comentário ainda. Seja o primeiro!',
                                  style: TextStyle(color: Colors.grey),
                                ),
                              ),
                            )
                          else
                            ..._comments.asMap().entries.map((entry) =>
                                _buildCommentTile(
                                  entry.value,
                                  depth: 0,
                                  isLast:
                                      entry.key == _comments.length - 1,
                                )),
                        ],
                      ),
                    ),

                    // Reply indicator
                    if (_replyToUsername != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 6),
                        color: Colors.grey[100],
                        child: Row(
                          children: [
                            const Icon(Icons.reply,
                                size: 16, color: Colors.grey),
                            const SizedBox(width: 8),
                            Text(
                              'Respondendo a @$_replyToUsername',
                              style: TextStyle(
                                  color: Colors.grey[600], fontSize: 13),
                            ),
                            const Spacer(),
                            GestureDetector(
                              onTap: _cancelReply,
                              child: const Icon(Icons.close,
                                  size: 18, color: Colors.grey),
                            ),
                          ],
                        ),
                      ),

                    // Comment input
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: Theme.of(context).scaffoldBackgroundColor,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 10,
                            offset: const Offset(0, -2),
                          ),
                        ],
                      ),
                      child: SafeArea(
                        child: Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _commentController,
                                decoration: InputDecoration(
                                  hintText: _replyToUsername != null
                                      ? 'Responder a @$_replyToUsername...'
                                      : 'Escreva um comentário...',
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(24),
                                    borderSide: BorderSide.none,
                                  ),
                                  filled: true,
                                  fillColor: Colors.grey[200],
                                  contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 16, vertical: 10),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            _isPostingComment
                                ? const SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2),
                                  )
                                : IconButton(
                                    onPressed: _postComment,
                                    icon: Icon(
                                      Icons.send_rounded,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .secondary,
                                    ),
                                  ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }

  /// Builds the full comment tree recursively
  Widget _buildCommentTile(Comment comment,
      {int depth = 0, bool isLast = false}) {
    final isOwn =
        _currentUserId != null && comment.usuario?.id == _currentUserId;
    final hasReplies = comment.respostas.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // The comment row with optional thread connector
        Padding(
          padding: EdgeInsets.only(left: depth * 32.0),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Thread connector for nested comments
                if (depth > 0)
                  SizedBox(
                    width: 24,
                    child: CustomPaint(
                      painter: _ThreadConnectorPainter(
                        isLast: isLast,
                        hasReplies: hasReplies,
                      ),
                      child: const SizedBox.expand(),
                    ),
                  ),

                // Avatar
                Padding(
                  padding: EdgeInsets.only(
                    top: 4,
                    left: depth > 0 ? 4 : 0,
                    right: 10,
                  ),
                  child: CircleAvatar(
                    radius: depth > 0 ? 14 : 18,
                    backgroundImage: comment.usuario?.avatar != null
                        ? CachedNetworkImageProvider(
                            comment.usuario!.avatar!)
                        : null,
                    child: comment.usuario?.avatar == null
                        ? Text(
                            comment.usuario?.nomeUsuario
                                    .substring(0, 1)
                                    .toUpperCase() ??
                                '?',
                            style: TextStyle(
                                fontSize: depth > 0 ? 11 : 14,
                                fontWeight: FontWeight.bold),
                          )
                        : null,
                  ),
                ),

                // Content
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 12, top: 2),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Name row: Nome Completo + @username + time
                        Row(
                          children: [
                            Flexible(
                              child: RichText(
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                text: TextSpan(
                                  children: [
                                    TextSpan(
                                      text: comment.usuario?.nomeCompleto ??
                                          comment.usuario?.nomeUsuario ??
                                          'Anônimo',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: Colors.black87,
                                        fontSize: 14,
                                      ),
                                    ),
                                    TextSpan(
                                      text:
                                          '  @${comment.usuario?.nomeUsuario ?? ''}',
                                      style: TextStyle(
                                        color: Colors.grey[500],
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '· ${timeago.format(comment.dataCriacao, locale: 'pt_BR')}',
                              style: TextStyle(
                                  color: Colors.grey[400], fontSize: 12),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),

                        // Comment text
                        Text(
                          comment.conteudoTexto,
                          style: const TextStyle(
                            fontSize: 14,
                            color: Colors.black87,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 6),

                        // Actions: Reply + Delete
                        Row(
                          children: [
                            GestureDetector(
                              onTap: () => _setReplyTo(comment),
                              child: Text(
                                'Responder',
                                style: TextStyle(
                                  color: Colors.grey[600],
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            if (isOwn) ...[
                              const SizedBox(width: 16),
                              GestureDetector(
                                onTap: () => _deleteComment(comment),
                                child: Text(
                                  'Excluir',
                                  style: TextStyle(
                                    color: Colors.red[400],
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // Nested replies
        if (hasReplies)
          ...comment.respostas.asMap().entries.map((entry) =>
              _buildCommentTile(
                entry.value,
                depth: depth + 1,
                isLast: entry.key == comment.respostas.length - 1,
              )),
      ],
    );
  }
}

class _ThreadConnectorPainter extends CustomPainter {
  final bool isLast;
  final bool hasReplies;

  _ThreadConnectorPainter({
    required this.isLast,
    required this.hasReplies,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.grey[400]!
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final startX = size.width * 0.4; // Starting point (vertical line)
    final endX = size.width; // Going towards the avatar
    final startY = 0.0;
    final midY = 22.0; // Level with avatar center
    final cornerRadius = 16.0;

    final path = Path();
    path.moveTo(startX, startY);

    // Draw line down to slightly above the turn
    path.lineTo(startX, midY - cornerRadius);

    // Draw curved corner
    path.quadraticBezierTo(
      startX, midY,
      startX + cornerRadius, midY,
    );

    // Draw line to the right (toward avatar)
    path.lineTo(endX, midY);

    canvas.drawPath(path, paint);

    // If NOT the last sibling, continue the vertical line further down
    if (!isLast) {
      canvas.drawLine(
        Offset(startX, midY),
        Offset(startX, size.height),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _ThreadConnectorPainter oldDelegate) {
    return oldDelegate.isLast != isLast || oldDelegate.hasReplies != hasReplies;
  }
}
