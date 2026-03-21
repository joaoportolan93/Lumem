import 'dart:math';

import 'package:flutter/material.dart';
import 'package:dreamshare/views/widgets/chat_bubble.dart';
import 'package:dreamshare/util/data.dart';

class Conversation extends StatefulWidget {
  const Conversation({super.key});

  @override
  _ConversationState createState() => _ConversationState();
}

class _ConversationState extends State<Conversation> {
  static Random random = Random();
  String name = names[random.nextInt(10)];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        elevation: 3,
        leading: IconButton(
          icon: const Icon(
            Icons.keyboard_backspace,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        titleSpacing: 0,
        title: InkWell(
          child: Row(
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.only(left: 0.0, right: 10.0),
                child: CircleAvatar(
                  backgroundImage: NetworkImage(
                    "https://picsum.photos/seed/user${random.nextInt(100)}/200",
                  ),
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      name,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 5),
                    const Text(
                      "Online",
                      style: TextStyle(
                        fontWeight: FontWeight.w400,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          onTap: () {},
        ),
        actions: <Widget>[
          IconButton(
            icon: const Icon(
              Icons.more_horiz,
            ),
            onPressed: () {},
          ),
        ],
      ),
      body: SizedBox(
        height: MediaQuery.of(context).size.height,
        child: Column(
          children: <Widget>[
            Flexible(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                itemCount: conversation.length,
                reverse: true,
                itemBuilder: (BuildContext context, int index) {
                  Map msg = conversation[index];
                  return ChatBubble(
                    message: msg['type'] == "text"
                        ? messages[random.nextInt(10)]
                        : "https://picsum.photos/seed/img${random.nextInt(100)}/400/300",
                    username: msg["username"],
                    time: msg["time"],
                    type: msg['type'],
                    replyText: msg["replyText"],
                    isMe: msg['isMe'],
                    isGroup: msg['isGroup'],
                    isReply: msg['isReply'],
                    replyName: name,
                  );
                },
              ),
            ),
            Align(
              alignment: Alignment.bottomCenter,
              child: BottomAppBar(
                elevation: 10,
                color: Theme.of(context).primaryColor,
                child: Container(
                  constraints: const BoxConstraints(
                    maxHeight: 100,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: <Widget>[
                      IconButton(
                        icon: Icon(
                          Icons.add,
                          color: Theme.of(context).colorScheme.secondary,
                        ),
                        onPressed: () {},
                      ),
                      Flexible(
                        child: TextField(
                          style: TextStyle(
                            fontSize: 15.0,
                            color:
                                Theme.of(context).textTheme.titleLarge?.color,
                          ),
                          decoration: InputDecoration(
                            contentPadding: const EdgeInsets.all(10.0),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            hintText: "Write your message...",
                            hintStyle: TextStyle(
                              fontSize: 15.0,
                              color:
                                  Theme.of(context).textTheme.titleLarge?.color,
                            ),
                          ),
                          maxLines: null,
                        ),
                      ),
                      IconButton(
                        icon: Icon(
                          Icons.mic,
                          color: Theme.of(context).colorScheme.secondary,
                        ),
                        onPressed: () {},
                      )
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
