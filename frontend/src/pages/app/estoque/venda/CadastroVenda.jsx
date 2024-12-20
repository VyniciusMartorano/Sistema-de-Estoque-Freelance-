import { useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { ButtonSGC } from '@/components/buttons'
import { DeletePopup } from '@/components/dialogs/delete-popup'
import { Select } from '@/components/input'
import { Input } from '@/components/input/input'
import { Screen } from '@/components/screen'
import { Table } from '@/components/table'
import { EstoqueContext } from '@/context/EstoqueContext'
import { useSGCNavigate } from '@/useNavigate'

import { InputCalendar } from '../../../../components/input/calendar'
import { InputNum } from '../../../../components/input/input-number'
import { AuthContext } from '../../../../context/AuthContext'
import { SGC_ROUTES } from '../../../../routes/navigation-routes'
// import { Formaters } from '../../../../utils/formaters'
import isEmpty from '../../../../utils/isEmpty'
import Service from './service'

export function CadastroVenda() {
  const { navigate } = useSGCNavigate()
  const { vendaId } = useContext(EstoqueContext)
  const { user } = useContext(AuthContext)
  const [itens, setItens] = useState([])
  const [produtos, setProdutos] = useState([])
  const [clientes, setClientes] = useState([])
  // const formatador = new Formaters()
  const [item, setItem] = useState({
    produto: null,
    quantidade: 0,
    preco_unitario: 0,
    saldo_disponivel: 0,
  })
  const [venda, setVenda] = useState({
    id: null,
    data_venda: new Date(),
    cliente: null,
    user: user?.id,
  })

  const [inPromise, setInPromise] = useState(false)
  const [inPromiseSearchProduto, setinPromiseSearchProduto] = useState(false)

  const service = new Service()
  const [inPromiseSave, setInPromiseSave] = useState(false)

  useEffect(() => {
    if (!vendaId) return

    setInPromise(true)
    service
      .getCiById(vendaId)
      .then(
        async ({ data }) => {
          data.data = new Date(data.data + ' 00:00:00')
          setVenda(data)
          getItensVenda(data.id)
        },
        () => {
          toast.error('Ocorreu um erro ao buscar o venda selecionada!')
        }
      )
      .finally(() => setInPromise(false))
  }, [])

  useEffect(() => {
    getProdutos()
    getClientes()
  }, [])

  const getProdutos = () => {
    setinPromiseSearchProduto(true)
    service
      .getProdutos()
      .then(
        ({ data }) => setProdutos(data),
        () => {
          toast.error('Ocorreu um erro ao buscar os produtos disponiveis!')
        }
      )
      .finally(() => setinPromiseSearchProduto(false))
  }
  const getClientes = () => {
    service.getClientes().then(
      ({ data }) => setClientes(data),
      () => {
        toast.error('Ocorreu um erro ao buscar os clientes!')
      }
    )
  }

  const getItensVenda = (vendaId) => {
    service.getItensVenda(vendaId).then(
      async ({ data }) => {
        setItens(data)
      },
      () => {
        toast.error('Ocorreu um erro ao buscar os itens da venda selecionada!')
      }
    )
  }

  const handleFieldChange = (e, field) => {
    const value = e.target ? e.target.value : e.value
    setVenda((prevProduto) => ({
      ...prevProduto,
      [field]: value,
    }))
  }
  const handleFieldItemChange = (e, field) => {
    const value = e.target ? e.target.value : e.value
    let produto = null

    if (field === 'produto') {
      produto = produtos.find((i) => i.id === value)
    }

    setItem((prevProduto) => ({
      ...prevProduto,
      [field]: value,
      saldo_disponivel: produto
        ? produto.saldo_disponivel
        : prevProduto.saldo_disponivel,
      preco_unitario: produto ? produto.preco_unitario : 0,
    }))
  }

  const payloadIsValid = (payload) => {
    if (!payload.tipo || !payload.observacao) {
      toast.warning('Preencha os campos obrigatórios e tente novamente!')
      return false
    }
    return true
  }
  const saveOrUpdateItens = (vendaId) => {
    const refatoredItens = itens.map((i) => {
      return { ...i, ci: vendaId }
    })
    service
      .saveItens(refatoredItens)
      .then(
        async ({ data }) => {
          setItens(data)
          toast.success('A venda foi salva com sucesso!')
          navigate(SGC_ROUTES.ESTOQUE.VENDA)
        },
        () => toast.error('Ocorreu um erro ao salvar a venda.')
      )
      .finally(() => {
        setInPromiseSave(false)
      })
  }

  const saveOrUpdate = () => {
    if (!payloadIsValid(venda)) return

    setInPromiseSave(true)
    const payload = {
      ...venda,
    }
    service.saveOrUpdate(payload).then(
      async (resp) => {
        setVenda({ ...resp.data, data: new Date(resp.data.data + ' 00:00:00') })
        saveOrUpdateItens(resp.data.id)
      },
      () => {
        toast.error('Ocorreu um erro ao salvar a venda.')
        setInPromiseSave(false)
      }
    )
  }
  const removeItem = (produtoId) => {
    setItens(itens.filter((i) => i.produto !== produtoId))
  }

  const addItem = () => {
    if (isEmpty(item)) {
      toast.warning('Preencha os campos corretamente para adicionar o item.')
      return
    }
    const produtoInList = itens.filter((i) => i.produto === item.produto)
    if (produtoInList.length > 0) {
      toast.warning(
        'O produto ja foi registrado na venda, remova da listagem e lance novamente!'
      )
      return
    }

    const produto = produtos.find((i) => i.id === item.produto)
    setItens([
      ...itens,
      {
        ...item,
        produto_label: produto.label,
      },
    ])
    setItem({
      produto: null,
      quantidade: 0,
      preco_unitario: 0,
      saldo_disponivel: 0,
    })
    getProdutos()
  }

  const headerTable = (
    <div className="grid">
      <Select
        label="Produto"
        className="mr-2 w-full"
        value={item.produto}
        onChange={(e) => handleFieldItemChange(e, 'produto')}
        options={produtos}
        optionLabel="label"
        optionValue="id"
        loading={inPromiseSearchProduto}
        filter
      />
      <InputNum
        disabled={!item.produto}
        value={item.quantidade}
        onChange={(e) => handleFieldItemChange(e, 'quantidade')}
        className="w-full"
        maxFractionDigits={2}
        label="Quantidade"
        locale="en-US"
        min={0.0}
        max={item.saldo_disponivel}
      />
      <InputNum
        disabled
        value={item.saldo_disponivel}
        className="w-full"
        maxFractionDigits={2}
        label="Saldo disponível"
        locale="en-US"
      />
      <InputNum
        disabled={!item.produto}
        value={item.preco_unitario}
        onChange={(e) => handleFieldItemChange(e, 'preco_unitario')}
        className="w-full"
        maxFractionDigits={2}
        minFractionDigits={2}
        locale="en-US"
        label="Preço Unitário"
        min={0}
      />

      <div className="mb-2 mr-1 mt-2 w-full md:w-3/6 lg:w-1/4 xl:w-1/5 ">
        <ButtonSGC
          disabled={inPromiseSave}
          label="Adicionar"
          icon="pi pi-plus"
          className="h-8 w-full"
          onClick={addItem}
          bgColor="sgc-green-primary"
          type="submit"
        />
      </div>
    </div>
  )

  return (
    <div>
      <Screen
        itens={[
          { label: 'venda', link: SGC_ROUTES.ESTOQUE.VENDA },
          {
            label: 'Cadastro',
            link: SGC_ROUTES.ESTOQUE.CADASTRO_VENDA,
          },
        ]}
      >
        <div>
          <div className="p-inputtext-sm my-6  flex flex-grow-0 flex-wrap">
            <div className="mr-1 w-full md:w-3/6 lg:w-1/4 xl:w-1/5">
              <InputCalendar
                disabled={true}
                value={venda.data_venda}
                className="w-full"
                label="Data"
              />
            </div>
            <div className="mr-1 w-full md:w-3/6 lg:w-1/4 xl:w-1/5">
              <Select
                label="Cliente"
                className="mr-2 w-full"
                value={venda.cliente}
                onChange={(e) => handleFieldChange(e, 'cliente')}
                options={clientes}
                optionLabel="nome"
                optionValue="id"
              />
            </div>
            <div className="mr-1 w-full md:w-3/6 lg:w-1/4 xl:w-1/5">
              <Input
                disabled={vendaId}
                value={venda.observacao}
                onChange={(e) => handleFieldChange(e, 'observacao')}
                type="text"
                className="w-full"
                label="Observação"
              />
            </div>
          </div>
          <h2>Itens</h2>
          <Table
            paginator={true}
            header={headerTable}
            value={itens}
            isLoading={inPromise}
            columns={[
              {
                field: 'produto_label',
                header: 'Produto',
                className: '8/12 p-1',
              },
              {
                field: 'quantidade',
                header: 'Quantidade',
                className: 'w-2/12 p-1 text-right',
              },
              {
                field: 'preco_unitario',
                header: 'P. Unit',
                className: 'w-2/12 p-1 text-right',
                body: (item) => <div>{item.preco_unitario.toFixed(2)}</div>,
              },
              {
                field: '',
                header: '',
                body: (item) =>
                  vendaId ? (
                    <div></div>
                  ) : (
                    <div className="flex h-6 justify-end gap-1 text-white">
                      <DeletePopup
                        feedbackMessage="Deseja realmente apagar o item?"
                        itemLabel={''}
                        onAccept={() => removeItem(item.produto)}
                      />
                    </div>
                  ),
                className: '',
              },
            ]}
          ></Table>

          <div className="mt-5 flex w-full flex-row flex-wrap justify-start gap-2">
            <div className="mr-1 w-full md:w-3/6 lg:w-1/4 xl:w-1/5 ">
              <ButtonSGC
                label="Voltar"
                bgColor="sgc-blue-primary"
                icon="pi pi-arrow-left"
                type="button"
                className="h-8 w-full"
                onClick={() => navigate(SGC_ROUTES.ESTOQUE.VENDA)}
              />
            </div>
            {!vendaId && (
              <div className="mr-1 w-full md:w-3/6 lg:w-1/4 xl:w-1/5 ">
                <ButtonSGC
                  disabled={inPromiseSave}
                  label="Salvar"
                  icon="pi pi-check"
                  className="h-8 w-full"
                  onClick={saveOrUpdate}
                  bgColor="sgc-green-primary"
                  type="submit"
                />
              </div>
            )}
          </div>
        </div>
      </Screen>
    </div>
  )
}
