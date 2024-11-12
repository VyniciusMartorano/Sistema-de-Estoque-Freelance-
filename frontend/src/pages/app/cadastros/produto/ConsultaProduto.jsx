import { Button } from 'primereact/button'
import { useContext, useEffect, useState } from 'react'
import { IoPencil } from 'react-icons/io5'
import { toast } from 'sonner'

import { IconButton } from '@/components/buttons'
import { DeletePopup } from '@/components/dialogs/delete-popup'
import { Input } from '@/components/input/input'
import { Screen } from '@/components/screen'
import { Table } from '@/components/table'
import { ProdutoContext } from '@/context/ProdutoContext'
import { useSGCNavigate } from '@/useNavigate'

import { SGC_ROUTES } from '../../../../routes/navigation-routes'
import Service from './service'

export function ConsultaProduto() {
  const { setProdutoId } = useContext(ProdutoContext)
  const { navigate } = useSGCNavigate()
  const [filter, setFilter] = useState('')
  const [produtos, setProdutos] = useState([])
  const [inPromise, setInPromise] = useState(false)
  const service = new Service()

  useEffect(() => {
    setProdutoId(null)
  }, [])

  const handleNavigateToEdit = (produtoId) => {
    setProdutoId(produtoId)
    navigate(SGC_ROUTES.CADASTROS.CADASTRO_PRODUTO)
  }

  const search = () => {
    setInPromise(true)
    service
      .search(filter)
      .then(
        ({ data }) => setProdutos(data),
        (error) =>
          toast.error(
            `Ocorreu um erro ao consultar os produtos. Erro: ${error}`
          )
      )
      .finally(() => setInPromise(false))
  }
  const deleteProduto = (produtoId) => {
    setInPromise(true)
    service
      .deleteProduto(produtoId)
      .then(
        () => {
          setProdutos(produtos.filter((i) => i.id !== produtoId))
          toast.success('O cliente foi deletado com sucesso!')
        },
        (error) => {
          if (error.response && error.response.status === 400) {
            toast.warning(error.response.data)
            return
          }
          toast.error(`Ocorreu um erro ao deletar o cliente. Erro: ${error}`)
        }
      )
      .finally(() => setInPromise(false))
  }

  const headerTable = (
    <div className="grid">
      <div className="col">
        <Button
          size="small"
          label="Novo"
          className="md:w-1/24  flex w-full items-center justify-center gap-2 rounded-md border-none bg-sgc-green-primary p-2 py-1  sm:w-full   lg:w-1/6 xl:w-1/6 2xl:w-1/6"
          onClick={() => navigate(SGC_ROUTES.CADASTROS.CADASTRO_PRODUTO)}
        >
          <i className="pi pi-plus"></i>
        </Button>
      </div>
    </div>
  )

  return (
    <div>
      <Screen
        itens={[{ label: 'Produtos', link: SGC_ROUTES.CADASTROS.PRODUTO }]}
      >
        <div className="p-inputtext-sm my-6 flex flex-grow-0 flex-wrap">
          <div className="mr-1 w-full md:w-3/6 lg:w-1/4 xl:w-1/5 ">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.vaeu)}
              type="text"
              className="w-full"
              label="Buscar"
            />
          </div>

          <div className="md:w-1/24 mt-2 w-full sm:mt-2 sm:w-full md:mt-2 lg:mt-0 lg:w-1/6 xl:w-1/6 2xl:w-1/6">
            <IconButton
              onClick={search}
              icon="pi pi-search sgc-blue-icons-primary"
              className="p-button p-button-primary w-full"
            />
          </div>
        </div>

        <Table
          paginator={true}
          header={headerTable}
          value={produtos}
          isLoading={inPromise}
          columns={[
            {
              field: 'nome',
              header: 'Nome',
              className: '1/12 p-1',
            },
            {
              field: 'preco',
              header: 'Preço',
              className: 'w-2/12 p-1',
            },
            {
              field: '',
              header: '',
              body: (item) => (
                <div className="flex h-6 justify-end gap-1 text-white">
                  <IconButton
                    containerHeight="h-6"
                    tooltip="Editar"
                    onClick={() => handleNavigateToEdit(item.id)}
                    iconComponent={<IoPencil size={18} />}
                    className="bg-sgc-blue-primary p-1"
                  />
                  <DeletePopup
                    feedbackMessage="Deseja realmente apagar o produto"
                    itemLabel={item.nome}
                    onAccept={() => deleteProduto(item.id)}
                  />
                </div>
              ),
              className: '',
            },
          ]}
        ></Table>
      </Screen>
    </div>
  )
}