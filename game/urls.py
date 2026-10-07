from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("api/game/new/", views.new_game, name="new_game"),
    path("api/game/move/", views.make_move, name="make_move"),
    path("api/game/undo/", views.undo_move, name="undo_move"),
]
