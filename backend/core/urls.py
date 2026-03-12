from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, UserProfileView, UserDetailView, LogoutView, 
    RequestPasswordResetCodeView, VerifyAndResetPasswordView,
    AvatarUploadView, PublicacaoViewSet, FollowView, SuggestedUsersView, 
    ComentarioViewSet, NotificacaoViewSet, SearchView, CustomTokenObtainPairView,
    GoogleLoginView,
    AdminStatsView, AdminUsersView, AdminUserDetailView, AdminReportsView, AdminReportActionView,
    CreateReportView, UserSettingsView, CloseFriendsManagerView, ToggleCloseFriendView,
    FollowRequestsView, FollowRequestActionView, ComunidadeViewSet, RascunhoViewSet,
    BlockView, MuteView, TrendView, TopCommunityPostsView,
    UserFollowersView, UserFollowingView,
    ConversationListView, ChatView, MessageReadView
)

# Router for ViewSets
router = DefaultRouter()
router.register(r'dreams', PublicacaoViewSet, basename='dreams')
router.register(r'notifications', NotificacaoViewSet, basename='notifications')
router.register(r'communities', ComunidadeViewSet, basename='communities')
router.register(r'drafts', RascunhoViewSet, basename='drafts')


# Nested router for comments
comments_list = ComentarioViewSet.as_view({'get': 'list', 'post': 'create'})
comments_detail = ComentarioViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'})
comments_react = ComentarioViewSet.as_view({'post': 'react'})

urlpatterns = [
    # Auth endpoints
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/google/', GoogleLoginView.as_view(), name='google_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/password-reset/request/', RequestPasswordResetCodeView.as_view(), name='password_reset_request'),
    path('auth/password-reset/verify/', VerifyAndResetPasswordView.as_view(), name='password_reset_verify'),
    
    # User endpoints
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('users/suggested/', SuggestedUsersView.as_view(), name='suggested_users'),
    path('search/', SearchView.as_view(), name='search'),
    path('users/<uuid:pk>/', UserDetailView.as_view(), name='user_detail'),
    path('users/avatar/', AvatarUploadView.as_view(), name='avatar_upload'),
    
    # Follow endpoints
    path('users/<uuid:pk>/follow/', FollowView.as_view(), name='follow'),
    path('users/<uuid:pk>/followers/', UserFollowersView.as_view(), name='user-followers'),
    path('users/<uuid:pk>/following/', UserFollowingView.as_view(), name='user-following'),
    path('users/<uuid:pk>/block/', BlockView.as_view(), name='block'),
    path('users/<uuid:pk>/mute/', MuteView.as_view(), name='mute'),
    
    # Follow requests endpoints
    path('follow-requests/', FollowRequestsView.as_view(), name='follow-requests'),
    path('follow-requests/<uuid:pk>/action/', FollowRequestActionView.as_view(), name='follow-request-action'),
    
    # Comments endpoints (nested under dreams)
    path('dreams/<uuid:dream_pk>/comments/', comments_list, name='dream-comments-list'),
    path('dreams/<uuid:dream_pk>/comments/<uuid:pk>/', comments_detail, name='dream-comments-detail'),
    path('dreams/<uuid:dream_pk>/comments/<uuid:pk>/react/', comments_react, name='dream-comments-react'),
    
    # Admin endpoints - Issue #29
    path('admin/stats/', AdminStatsView.as_view(), name='admin-stats'),
    path('admin/users/', AdminUsersView.as_view(), name='admin-users'),
    path('admin/users/<uuid:pk>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/reports/', AdminReportsView.as_view(), name='admin-reports'),
    path('admin/reports/<uuid:pk>/action/', AdminReportActionView.as_view(), name='admin-report-action'),
    
    # User reports
    path('denuncias/', CreateReportView.as_view(), name='create-report'),
    
    # Settings and Close Friends endpoints
    path('settings/', UserSettingsView.as_view(), name='user-settings'),
    path('friends/manage/', CloseFriendsManagerView.as_view(), name='close-friends-manage'),
    path('friends/toggle/<uuid:pk>/', ToggleCloseFriendView.as_view(), name='close-friends-toggle'),
    
    # Explore page endpoints
    path('trends/', TrendView.as_view(), name='trends'),
    path('communities/top-posts/', TopCommunityPostsView.as_view(), name='community-top-posts'),
    
    # Chat / Direct Messages endpoints
    path('chat/conversations/', ConversationListView.as_view(), name='chat-conversations'),
    path('chat/messages/<uuid:pk>/', ChatView.as_view(), name='chat-messages'),
    path('chat/messages/<uuid:pk>/read/', MessageReadView.as_view(), name='chat-message-read'),
    
    # Include router URLs (dreams CRUD + notifications)
    path('', include(router.urls)),
]
