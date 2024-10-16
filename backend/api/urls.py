from . import views as v
from rest_framework import routers


router = routers.DefaultRouter()
router.register('user', v.UserViewSet)
router.register('clientes', v.ClienteViewSet)


urlpatterns = router.urls

