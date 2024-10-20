import { AxiosError } from 'axios'
import { createContext, useEffect, useState } from 'react'
import { useCookies } from 'react-cookie'
import { toast } from 'sonner'

import { coreApi } from '@/api/apibase'
import { AuthService } from '@/services/auth'
import { Formaters } from '@/utils'

export const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)
  const [isLoading, setIsLoading] = useState(false)

  const [cookies, setCookie, removeCookie] = useCookies([
    'auth.token',
    'auth.refreshToken',
  ])

  const token = cookies['auth.token']
  const refreshToken = cookies['auth.refreshToken']
  const isAuthenticated = !!token

  useEffect(() => {
    if (token) {
      coreApi.interceptors.response.use(
        (response) => {
          return response
        },
        async (error) => {
          if (
            error.response?.status !== 401 ||
            error.response?.data.detail ===
              'No active account found with the given credentials'
          ) {
            return Promise.reject(error)
          }
          if (error.response.status === 'falha') {
            return Promise.reject(error)
          }

          if (error.config.url === CORE_URLS.REFRESH_TOKEN) {
            signOut()

            return Promise.reject(error)
          }

          return coreApi
            .post(CORE_URLS.REFRESH_TOKEN, {
              refresh: refreshToken,
            })
            .then((response) => {
              error.response.config.headers.Authorization = `Bearer ${response.data.access}`
              coreApi.defaults.headers.Authorization = `Bearer ${response.data.access}`

              setCookie('auth.token', response.data.access, {
                path: '/',
              })

              setCookie('auth.refreshToken', refreshToken, {
                path: '/',
              })

              return coreApi(error.response.config)
            })
            .catch(() => signOut())
        }
      )

      if (!user?.username) {
        coreApi.defaults.headers.Authorization = `Bearer ${token}`
        setIsLoading(true)
        toast.promise(
          AuthService.getUserData(token)
            .then((user) => {
              if (user.username) {
                setUser(user)
              }
            })
            .finally(() => setIsLoading(false))
        )
      }
    }
  }, [token])

  async function signUp({ cpf, username, password }) {
    try {
      const userRegistered = await AuthService.getUserRegistered(username)

      if (userRegistered) {
        await AuthService.changeUserPassword({
          username,
          cpf,
          password,
          userId: userRegistered.id,
        })

        await signIn({ username, password })
      }

      const registryByCpf = await AuthService.getRegistryByCpf(
        Formaters.formatCPF(cpf)
      )

      if (registryByCpf === username) {
        await signIn({ username, password })
      }
    } catch (error) {
      throw new AxiosError(error)
    }
  }

  async function signIn({ username, password }) {
    try {
      const response = await AuthService.signIn({
        username,
        password,
      })

      const { access, refresh } = response

      coreApi.defaults.headers.Authorization = `Bearer ${access}`
      const user = await AuthService.getUserData(access)
      if (user.username) {
        setUser(user)
      }

      setCookie('auth.token', access, {
        path: '/',
      })

      setCookie('auth.refreshToken', refresh, {
        path: '/',
      })
    } catch (err) {
      throw new AxiosError(err)
    }
  }

  function signOut() {
    removeCookie('auth.token', { path: '/' })
    removeCookie('auth.refreshToken', { path: '/' })
    setUser(undefined)
    coreApi.defaults.headers.Authorization = ''
  }

  function validateUserPermission(permission) {
    const userPermissions = user?.user_permissions
    if (!userPermissions) {
      return false
    }
    return userPermissions.includes(permission)
  }

  return (
    <AuthContext.Provider
      value={{
        signIn,
        signOut,
        signUp,
        validateUserPermission,
        isAuthenticated,
        isLoading,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
