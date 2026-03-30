from django.urls import path
from . import views

urlpatterns = [
    path('rides/', views.get_rides),
    path('create/', views.create_ride),
    path('request/<int:ride_id>/', views.request_ride),
    path('approve/<int:request_id>/', views.approve_request),
]