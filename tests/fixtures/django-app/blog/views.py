from django.http import JsonResponse


def index(request):
    return JsonResponse([], safe=False)


def year_archive(request, year):
    return JsonResponse({"year": year})


def feed(request):
    return JsonResponse({"feed": []})
