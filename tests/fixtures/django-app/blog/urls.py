from django.urls import path, re_path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("<int:year>/", views.year_archive, name="year-archive"),
    re_path(r"^feed/$", views.feed, name="feed"),
]
