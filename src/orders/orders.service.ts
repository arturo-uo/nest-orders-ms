import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { CreateOrderDto } from './dto/create-order.dto'
import { UpdateOrderDto } from './dto/update-order.dto'
import { PrismaClient } from '@prisma/client'
import { ClientProxy, RpcException } from '@nestjs/microservices'
import { ChangeOrderStatusDto, OrderPaginationDto } from './dto'
import { PRODUCT_SERVICE } from 'src/config'
import { firstValueFrom } from 'rxjs'
import { RpcCustomExceptionFilter } from 'src/common'

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  private readonly logger = new Logger('OrdersService')

  constructor(
    @Inject(PRODUCT_SERVICE)
    private readonly productsClient: ClientProxy) {
    super()
  }

  async onModuleInit() {
    await this.$connect()
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      const productIds = createOrderDto.items.map((item) => item.productId)
      const products: any[] = await firstValueFrom(
        this.productsClient.send({ cmd: 'validate_products' }, productIds)
      )

      const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
        const price = products.find(
          product => product.id == orderItem.productId).price
        return price * orderItem.quantity
      }, 0)

      const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
        return acc + orderItem.quantity
      }, 0)

      const order = await this.order.create({
        data: {
          totalAmount: totalAmount,
          totalItems: totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map((orderItem) => ({
                price: products.find(product => product.id === orderItem.productId).price,
                productId: orderItem.productId,
                quantity: orderItem.quantity
              }))
            }
          }
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true
            }
          }
        }
      })

      return {
        ...order,
        OrderItem: order.OrderItem.map((orderItem) => ({
          ...orderItem,
          name: products.find(product => product.id === orderItem.productId).name
        }))
      }
    }
    catch (error: Error | any) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Check logs'
      })
    }

    // return {
    //   service:'Orders microservice',
    //   createOrderDto: createOrderDto
    // }

    // return this.order.create({
    //   data: createOrderDto
    // })
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const { status, page, limit } = orderPaginationDto;

    const totalPages = await this.order.count({
      where: { status }
    });
    const lastPage = Math.ceil(totalPages / limit!);
    return {
      data: await this.order.findMany({
        skip: (page! - 1) * limit!,
        take: limit,
        where: {
          status
        }
      }),
      meta: {
        total: totalPages,
        page: page,
        lastPage: lastPage,
      }
    }
  }

  async findOne(id: string) {
    const order = await this.order.findFirst({
      where: { id },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true
          }
        }
      }
    })
    if (!order)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: 'Order nor found'
      })

    const productsIds = order.OrderItem.map(orderItem => orderItem.productId)
    const products: any[] = await firstValueFrom(
      this.productsClient.send({ cmd: 'validate_products' }, productsIds)
    )
    return {
      ...order,
      OrderItem: order.OrderItem.map(orderItem => ({
        ...orderItem,
        name: products.find(product => product.id === orderItem.productId).name
      }))
    }
  }

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto
    const order = await this.findOne(id)

    if (order.status === status)
      return order

    return this.order.update({
      where: { id },
      data: {
        status: status
      }
    })
  }
}
