import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { CreateOrderDto } from './dto/create-order.dto'
import { UpdateOrderDto } from './dto/update-order.dto'
import { PrismaClient } from '@prisma/client'
import { RpcException } from '@nestjs/microservices'
import { OrderPaginationDto } from './dto'

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  private readonly logger = new Logger('OrdersService')

  async onModuleInit() {
    await this.$connect()
  }

  create(createOrderDto: CreateOrderDto) {

    return this.order.create({
      data: createOrderDto
    })
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const { status, page, limit } = orderPaginationDto;

    const totalPages = await this.order.count({ 
      where: { status } 
    });
    const lastPage = Math.ceil( totalPages / limit! );
    return {
      data: await this.order.findMany({
        skip: ( page! - 1 ) * limit!,
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
      where: { id }
    })
    if (!order)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: 'Order nor found'
      })
    return order
  }
}
