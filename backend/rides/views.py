from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Ride, RideRequest
from .serializers import RideSerializer, RideRequestSerializer
from django.contrib.auth.models import User
@api_view(['POST'])
def create_ride(request):
    user = User.objects.first()  
    
    serializer = RideSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(owner=user)
        return Response(serializer.data)
    return Response(serializer.errors)
@api_view(['GET'])
def get_rides(request):
    rides = Ride.objects.all()
    serializer = RideSerializer(rides, many=True)
    return Response(serializer.data)
@api_view(['POST'])
def request_ride(request, ride_id):
    try:
        ride = Ride.objects.get(id=ride_id)
    except Ride.DoesNotExist:
        return Response({"error": "Ride not found"})
    
    user = User.objects.last()   
    
    if not user:
        return Response({"error": "No users found"})
    
    if RideRequest.objects.filter(ride=ride, user=user).exists():
        return Response({"error": "Already requested"})
    
    RideRequest.objects.create(
        ride=ride,
        user=user
    )
    
    return Response({"message": "Request sent"})
    
@api_view(['POST'])
def approve_request(request, request_id):
    ride_request = RideRequest.objects.get(id=request_id)
    from django.contrib.auth.models import User

@api_view(['POST'])
def approve_request(request, request_id):
    try:
        ride_request = RideRequest.objects.get(id=request_id)
    except RideRequest.DoesNotExist:
        return Response({"error": "Request not found"})

    ride = ride_request.ride

    user = User.objects.first()  

    
    if ride.owner != user:
        return Response({"error": "Not allowed"})

    if ride.seats_available <= 0:
        return Response({"error": "No seats available"})

    ride_request.status = "approved"
    ride_request.save()

    ride.seats_available -= 1
    ride.save()

    
    if ride.seats_available == 0:
        ride.delete()

    return Response({"message": "Request approved"})
