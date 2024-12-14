from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from . import serializers as s
from . import models as m
from django.contrib.auth.models import Permission
from . import filters as f 
from django.db.models import Q
from rest_framework.exceptions import ValidationError
from rest_framework_bulk import BulkModelViewSet


class UserViewSet(viewsets.ModelViewSet):
    queryset = m.User.objects.all()
    serializer_class = s.UserSerializer
    # permission_classes = [AllowAny]

    def list(self, request):
        return Response(s.UserSerializer(request.user).data)
    

    @action(detail=False, methods=['post'])
    def search(self, *args, **kwargs):
        req = self.request.data
        nome = req['nome'] if 'nome' in req else None
        tipo = req['tipo'] if 'tipo' in req else None

        queryset = m.User.objects.all()

        if nome:
            queryset = queryset.filter(first_name__icontains=nome)
        
        if tipo:
            if tipo == 1:
                queryset = queryset.filter(is_gerente=1)
            elif tipo == 2:
                queryset = queryset.filter(is_vendedor=1)

        serializer = s.UserSerializer(queryset, many=True)

        return Response(serializer.data)
    


    @action(detail=False, methods=['GET'])
    def get_gestores(self, *args, **kwargs):
        qs = m.User.objects.filter(is_gerente=1)
        serializer = s.UserSerializer(qs, many=True).data
        return Response(data=serializer, status=status.HTTP_200_OK)

    @action(detail=False, methods=['GET'])
    def get_all(self, *args, **kwargs):
        qs = m.User.objects.all().order_by('-id')
        serializer = s.UserDTOSerializer(qs, many=True).data
        return Response(data=serializer, status=status.HTTP_200_OK)



    @action(detail=False, methods=['post'])
    def update_password(self, *args, **kwargs):
        req = self.request.data
        email = req['email'] if 'email' in req else None
        password = req['password'] if 'password' in req else None

        if not (email and password):
            return Response(data='Envie o email e a senha', status=status.HTTP_400_BAD_REQUEST)

        user = m.User.objects.get(username=email)
        user.set_password(password)
        user.save()
        return Response(data='', status=status.HTTP_200_OK)
    

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        print(data)
        password = data.pop('password', None)
        


        if not password:
            return Response(
                {"error": "Password is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()

        user.set_password(str(password))
        user.save()

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class PermissionViewSet(viewsets.ViewSet):
    def list(self, request):
        return Response(request.user.get_all_permissions())



class MenuItemViewSet(viewsets.ViewSet):
    queryset = m.MenuItem.objects.all()


    def list(self, request):
        all_permissions = [
            Permission.objects.get(content_type__app_label=perm_name.split('.')[0], codename=perm_name.split('.')[1])
            for perm_name in request.user.get_all_permissions() if perm_name.startswith('api.menu')
        ]

        menuitems = [
            {
                'id': item_1.pk,
                'label': item_1.label,
                'icon': item_1.icon,
                'to': item_1.to_url,
                'father': None,
            }
            for item_1 in m.MenuItem.objects.filter(father__isnull=True).order_by('label') if
            item_1.permission in all_permissions]

        for item_1 in menuitems:
            menuitem_1 = m.MenuItem.objects.get(pk=item_1['id'], father_id=item_1['father'])
            filhos_01 = menuitem_1.children()

            if len(filhos_01):
                item_1['items'] = [
                    {
                        'id': item_2.pk,
                        'label': item_2.label,
                        'icon': item_2.icon,
                        'to': item_2.to_url,
                        'father': item_2.father.id,
                    } for item_2 in filhos_01 if item_2.permission in all_permissions]
                

                for item_2 in item_1['items']:
                    menuitem_2 = m.MenuItem.objects.get(pk=item_2['id'], father__id=item_2['father'])
                    filhos_02 = menuitem_2.children()
                    
                    if len(filhos_02):
                        item_2['items'] = [
                            {
                                'id': item_3.pk,
                                'label': item_3.label,
                                'icon': item_3.icon,
                                'to': item_3.to_url,
                                'father': item_3.father.id,
                            } for item_3 in filhos_02 if item_3.permission in all_permissions]
                        

                
        serializer = s.MenuItemSerializer(menuitems, many=True)
        return Response(serializer.data)



class ClienteViewSet(viewsets.ModelViewSet):
    queryset = m.Cliente.objects.using('default').all()
    serializer_class = s.ClienteSerializer
    filterset_class = f.ClienteFilter


    
    def list(self, request):
        qs = m.Cliente.objects.using('default').all()
        user = self.request.user

        if user.is_adm:
           pass
        elif user.is_gerente:
            qs = qs.filter(gestor=user.pk)
        elif user.is_vendedor:
            gestores = m.GestoresVendedores.objects.filter(
                vendedor=user.pk
            ).values_list('gestor_id',flat=True)
            qs = qs.filter(gestor_id__in=gestores)

        serializer = self.serializer_class(qs, many=True).data
        return Response(data=serializer, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def search(self, *args, **kwargs):
        req = self.request.data
        nome = req['nome'] if 'nome' in req else None
        gestor_id = req['gestor_id'] if 'gestor_id' in req else None

        queryset = m.Cliente.objects.all()

        if nome:
            queryset = queryset.filter(nome__istartswith=nome)
        
        if gestor_id:
            queryset = queryset.filter(gestor_id=gestor_id)

        serializer = s.ClienteSerializer(queryset, many=True)

        return Response(serializer.data)
    


class ProdutoViewSet(viewsets.ModelViewSet):
    queryset = m.Produto.objects.using('default').all()
    serializer_class = s.ProdutoSerializer


    @action(detail=False, methods=['get'])
    def search(self, *args, **kwargs):
        query = self.request.GET.get("query", "")

        queryset = m.Produto.objects.filter(
            Q(nome__icontains=query) |
            Q(descricao__icontains=query) 
        )

        serializer = s.ProdutoDTOSerializer(queryset, many=True)
        return Response(serializer.data)
    

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        user = request.user

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        m.ProdutosPrecosUsuarios.objects.update_or_create(
            user_id=user.pk,
            produto_id=instance.pk,
            percentual=request.data['percentual']
        )

        self.perform_update(serializer)

        return Response(serializer.data)
    

    def create(self, request, *args, **kwargs):
        user = request.user

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        m.ProdutosPrecosUsuarios.objects.update_or_create(
            user_id=user.pk,
            produto_id=instance.pk,
            percentual=request.data['percentual']
        )

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        qs_venda = m.VendaItem.objects.filter(
            produto_id=instance.pk
        )

        qs_estoque_mov = m.EstoqueExtrato.objects.filter(
            produto_id=instance.pk
        )
        
        if (qs_estoque.count() + qs_estoque_mov.count() + qs_venda.count()) > 0:
            return Response(
                data='Não é possivel apagar um produto que ja tem [vendas, estoque] registrados(as).',
                status=status.HTTP_400_BAD_REQUEST
            )
        
        m.ProdutosPrecosUsuarios.objects.filter(produto=instance.pk).delete()
        
        self.perform_destroy(instance)
        
        return Response(
            {"detail": "Produto deletado com sucesso."},
            status=status.HTTP_204_NO_CONTENT
        )



class VendaViewSet(viewsets.ModelViewSet):
    queryset = m.Venda.objects.using('default').all()
    serializer_class = s.VendaSerializer


    @action(detail=False, methods=['post'])
    def search(self, *args, **kwargs):
        queryset = m.Venda.objects.order_by('-id')
        req = self.request.data

        de = req['de'] if 'de' in req else None
        ate = req['ate'] if 'ate' in req else None
        cliente = req['cliente'] if 'cliente' in req else None
        user = req['user'] if 'user' in req else None


        if de:
            queryset = queryset.filter(data_venda__gte=de)

        if ate:
            queryset = queryset.filter(data_venda__lte=ate)
        
        if cliente:
            queryset = queryset.filter(observacao__icontains=cliente)

        if user:
            queryset = queryset.filter(user=user)

        serializer = self.serializer_class(queryset, many=True)

        return Response(serializer.data)
    





class VendaItemViewSet(viewsets.ModelViewSet):
    queryset = m.VendaItem.objects.using('default').all()
    serializer_class = s.VendaItemSerializer


class EstoqueExtratoViewSet(viewsets.ModelViewSet):
    queryset = m.EstoqueExtrato.objects.using('default').all()
    serializer_class = s.EstoqueExtratoSerializer

    @action(detail=False, methods=['post'])
    def search(self, *args, **kwargs):
        req = self.request.data

        de = req['de'] if 'de' in req else None
        ate = req['ate'] if 'ate' in req else None
        tipo = req['tipo'] if 'tipo' in req else None
        tipomov = req['tipomov'] if 'tipomov' in req else None
        user = req['user'] if 'user' in req else None
        produto = req['produto'] if 'produto' in req else None

        queryset = m.EstoqueExtrato.objects.order_by('-id')

        if de:
            queryset = queryset.filter(data__gte=de)

        if ate:
            queryset = queryset.filter(data__lte=ate)
        
        if tipo:
            queryset = queryset.filter(tipo=tipo)

        if tipomov:
            queryset = queryset.filter(tipomov=tipomov)
        
        if user:
            queryset = queryset.filter(user=user)

        if produto:
            queryset = queryset.filter(produto=produto)

        serializer = self.serializer_class(queryset, many=True)

        return Response(serializer.data)
    


class ProdutosPrecosUsuariosViewSet(viewsets.ModelViewSet):
    queryset = m.ProdutosPrecosUsuarios.objects.using('default').all()
    serializer_class = s.ProdutosPrecosUsuariosSerializer



class CIViewSet(viewsets.ModelViewSet):
    queryset = m.CI.objects.all()
    serializer_class = s.CISerializer

    @action(detail=False, methods=['post'])
    def search(self, *args, **kwargs):
        req = self.request.data

        de = req['de'] if 'de' in req else None
        ate = req['ate'] if 'ate' in req else None
        observacao = req['observacao'] if 'observacao' in req else None
        tipo = req['tipo'] if 'tipo' in req else None

        queryset = m.CI.objects.all()

        if de:
            queryset = queryset.filter(data__gte=de)
        if ate:
            queryset = queryset.filter(data__lte=ate)
        
        if tipo:
            queryset = queryset.filter(tipo=tipo)
        
        if observacao:
            queryset = queryset.filter(observacao__icontains=observacao)

        serializer = s.CISerializer(queryset.order_by('-id'), many=True)

        return Response(serializer.data)
    


class CIITEMViewSet(BulkModelViewSet):
    queryset = m.CI_ITEM.objects.all()
    serializer_class = s.CIITEMSerializer




    @action(detail=False, methods=['post'])
    def search(self, *args, **kwargs):
        req = self.request.data
        
        ci_id = req['ci_id'] if 'ci_id' in req else None

        queryset = m.CI_ITEM.objects.all()
        
        if ci_id:
            queryset = queryset.filter(ci=ci_id)

        serializer = self.serializer_class(queryset.order_by('-id'), many=True)

        return Response(serializer.data)
