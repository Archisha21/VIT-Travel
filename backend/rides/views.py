from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Ride, RideRequest
from .serializers import RideSerializer, RideRequestSerializer
@api_view(['POST'])
def create_ride(request):
    serializer = RideSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(owner=request.user)
        return Response(serializer.data)
    return Response(serializer.errors)
@api_view(['GET'])
def get_rides(request):
    rides = Ride.objects.all()
    serializer = RideSerializer(rides, many=True)
    return Response(serializer.data)
@api_view(['POST'])
def request_ride(request, ride_id):
    ride = Ride.objects.get(id=ride_id)
    
    RideRequest.objects.create(
        ride=ride,
        user=request.user
    )
    
    return Response({"message": "Request sent"})
@api_view(['POST'])
def approve_request(request, request_id):
    ride_request = RideRequest.objects.get(id=request_id)
    
    if ride_request.ride.owner != request.user:
        return Response({"error": "Not allowed"})
    
    ride_request.status = 'approved'
    ride_request.save()

    ride = ride_request.ride
    ride.seats_available -= 1

    if ride.seats_available == 0:
        ride.delete()
    else:
        ride.save()

    return Response({"message": "Request approved"})
